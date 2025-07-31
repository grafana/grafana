package notifier

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/alerting/notify/nfstatus"
	"github.com/prometheus/client_golang/prometheus"

	alertingCluster "github.com/grafana/alerting/cluster"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrNoAlertmanagerForOrg = fmt.Errorf("Alertmanager does not exist for this organization")
	ErrAlertmanagerNotReady = fmt.Errorf("Alertmanager is not ready yet")
)

// errutil-based errors.
// TODO: Should completely replace the fmt.Errorf-based errors.
var (
	ErrAlertmanagerNotFound = errutil.NotFound("alerting.notifications.alertmanager.notFound")
	ErrAlertmanagerConflict = errutil.Conflict("alerting.notifications.alertmanager.conflict")

	ErrSilenceNotFound    = errutil.NotFound("alerting.notifications.silences.notFound")
	ErrSilencesBadRequest = errutil.BadRequest("alerting.notifications.silences.badRequest")
	ErrSilenceInternal    = errutil.Internal("alerting.notifications.silences.internal")
)

//go:generate mockery --name Alertmanager --structname AlertmanagerMock --with-expecter --output alertmanager_mock --outpkg alertmanager_mock
type Alertmanager interface {
	// Configuration
	ApplyConfig(context.Context, *models.AlertConfiguration) error
	SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error
	SaveAndApplyDefaultConfig(ctx context.Context) error
	GetStatus(context.Context) (apimodels.GettableStatus, error)

	// Silences
	CreateSilence(context.Context, *apimodels.PostableSilence) (string, error)
	DeleteSilence(context.Context, string) error
	GetSilence(context.Context, string) (apimodels.GettableSilence, error)
	ListSilences(context.Context, []string) (apimodels.GettableSilences, error)

	// SilenceState returns the current state of silences in the Alertmanager. This is used to persist the state
	// to the kvstore.
	SilenceState(context.Context) (alertingNotify.SilenceState, error)

	// Alerts
	GetAlerts(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error)
	GetAlertGroups(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error)
	PutAlerts(context.Context, apimodels.PostableAlerts) error

	// Receivers
	GetReceivers(ctx context.Context) ([]apimodels.Receiver, error)
	TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*alertingNotify.TestReceiversResult, int, error)
	TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error)

	// Lifecycle
	StopAndWait()
	Ready() bool
}

// ExternalState holds nflog entries and silences from an external Alertmanager.
type ExternalState struct {
	Silences []byte
	Nflog    []byte
}

// StateMerger describes a type that is able to merge external state (nflog, silences) with its own.
type StateMerger interface {
	MergeState(ExternalState) error
}

type MultiOrgAlertmanager struct {
	Crypto    Crypto
	ProvStore provisioningStore

	alertmanagersMtx sync.RWMutex
	alertmanagers    map[int64]Alertmanager

	settingsProvider setting.SettingsProvider
	featureManager   featuremgmt.FeatureToggles
	logger           log.Logger

	// clusterPeer represents the clustering peers of Alertmanagers between Grafana instances.
	peer         alertingNotify.ClusterPeer
	settleCancel context.CancelFunc

	configStore AlertingStore
	orgStore    store.OrgStore
	kvStore     kvstore.KVStore
	factory     OrgAlertmanagerFactory

	decryptFn alertingNotify.GetDecryptedValueFn

	metrics *metrics.MultiOrgAlertmanager
	ns      notifications.Service

	receiverResourcePermissions ac.ReceiverPermissionsService
}

type OrgAlertmanagerFactory func(ctx context.Context, orgID int64) (Alertmanager, error)

type Option func(*MultiOrgAlertmanager)

func WithAlertmanagerOverride(f func(OrgAlertmanagerFactory) OrgAlertmanagerFactory) Option {
	return func(moa *MultiOrgAlertmanager) {
		moa.factory = f(moa.factory)
	}
}

func NewMultiOrgAlertmanager(
	settingsProvider setting.SettingsProvider,
	configStore AlertingStore,
	orgStore store.OrgStore,
	kvStore kvstore.KVStore,
	provStore provisioningStore,
	decryptFn alertingNotify.GetDecryptedValueFn,
	m *metrics.MultiOrgAlertmanager,
	ns notifications.Service,
	receiverResourcePermissions ac.ReceiverPermissionsService,
	l log.Logger,
	s secrets.Service,
	featureManager featuremgmt.FeatureToggles,
	notificationHistorian nfstatus.NotificationHistorian,
	opts ...Option,
) (*MultiOrgAlertmanager, error) {
	moa := &MultiOrgAlertmanager{
		Crypto:    NewCrypto(s, configStore, l),
		ProvStore: provStore,

		logger:                      l,
		settingsProvider:            settingsProvider,
		featureManager:              featureManager,
		alertmanagers:               map[int64]Alertmanager{},
		configStore:                 configStore,
		orgStore:                    orgStore,
		kvStore:                     kvStore,
		decryptFn:                   decryptFn,
		receiverResourcePermissions: receiverResourcePermissions,
		metrics:                     m,
		ns:                          ns,
		peer:                        &NilPeer{},
	}

	cfg := settingsProvider.Get()
	if cfg.UnifiedAlerting.SkipClustering {
		l.Info("Skipping setting up clustering for MOA")
	} else {
		if err := moa.setupClustering(cfg); err != nil {
			return nil, err
		}
	}

	// Set up the default per tenant Alertmanager factory.
	moa.factory = func(ctx context.Context, orgID int64) (Alertmanager, error) {
		m := metrics.NewAlertmanagerMetrics(moa.metrics.GetOrCreateOrgRegistry(orgID), l)
		stateStore := NewFileStore(orgID, kvStore)
		return NewAlertmanager(ctx, orgID, moa.settingsProvider, moa.configStore, stateStore, moa.peer, moa.decryptFn, moa.ns, m, featureManager, moa.Crypto, notificationHistorian)
	}

	for _, opt := range opts {
		opt(moa)
	}

	return moa, nil
}

func (moa *MultiOrgAlertmanager) setupClustering(cfg *setting.Cfg) error {
	clusterLogger := moa.logger.New("component", "clustering")
	// We set the settlement timeout to be a multiple of the gossip interval,
	// ensuring that a sufficient number of broadcasts have occurred, thereby
	// increasing the probability of success when waiting for the cluster to settle.
	const settleTimeout = alertingCluster.DefaultGossipInterval * 10
	// Redis setup.
	if cfg.UnifiedAlerting.HARedisAddr != "" {
		redisPeer, err := newRedisPeer(redisConfig{
			addr:             cfg.UnifiedAlerting.HARedisAddr,
			name:             cfg.UnifiedAlerting.HARedisPeerName,
			prefix:           cfg.UnifiedAlerting.HARedisPrefix,
			password:         cfg.UnifiedAlerting.HARedisPassword,
			username:         cfg.UnifiedAlerting.HARedisUsername,
			db:               cfg.UnifiedAlerting.HARedisDB,
			maxConns:         cfg.UnifiedAlerting.HARedisMaxConns,
			tlsEnabled:       cfg.UnifiedAlerting.HARedisTLSEnabled,
			tls:              cfg.UnifiedAlerting.HARedisTLSConfig,
			clusterMode:      cfg.UnifiedAlerting.HARedisClusterModeEnabled,
			sentinelMode:     cfg.UnifiedAlerting.HARedisSentinelModeEnabled,
			masterName:       cfg.UnifiedAlerting.HARedisSentinelMasterName,
			sentinelUsername: cfg.UnifiedAlerting.HARedisSentinelUsername,
			sentinelPassword: cfg.UnifiedAlerting.HARedisSentinelPassword,
		}, clusterLogger, moa.metrics.Registerer, cfg.UnifiedAlerting.HAPushPullInterval)
		if err != nil {
			return fmt.Errorf("unable to initialize redis: %w", err)
		}
		var ctx context.Context
		ctx, moa.settleCancel = context.WithTimeout(context.Background(), 30*time.Second)
		go redisPeer.Settle(ctx, settleTimeout)
		moa.peer = redisPeer
		return nil
	}
	// Memberlist setup.
	if len(cfg.UnifiedAlerting.HAPeers) > 0 {
		peer, err := alertingCluster.Create(
			clusterLogger,
			moa.metrics.Registerer,
			cfg.UnifiedAlerting.HAListenAddr,
			cfg.UnifiedAlerting.HAAdvertiseAddr,
			cfg.UnifiedAlerting.HAPeers, // peers
			true,
			cfg.UnifiedAlerting.HAPushPullInterval,
			cfg.UnifiedAlerting.HAGossipInterval,
			alertingCluster.DefaultTCPTimeout,
			alertingCluster.DefaultProbeTimeout,
			alertingCluster.DefaultProbeInterval,
			nil,
			true,
			cfg.UnifiedAlerting.HALabel,
		)
		if err != nil {
			return fmt.Errorf("unable to initialize gossip mesh: %w", err)
		}

		err = peer.Join(alertingCluster.DefaultReconnectInterval, cfg.UnifiedAlerting.HAReconnectTimeout)
		if err != nil {
			moa.logger.Error("Msg", "Unable to join gossip mesh while initializing cluster for high availability mode", "error", err)
		}
		// Attempt to verify the number of peers for 30s every 2s. The risk here is what we send a notification "too soon".
		// Which should _never_ happen given we share the notification log via the database so the risk of double notification is very low.
		var ctx context.Context
		ctx, moa.settleCancel = context.WithTimeout(context.Background(), 30*time.Second)
		go peer.Settle(ctx, settleTimeout)
		moa.peer = peer
		return nil
	}
	return nil
}

func (moa *MultiOrgAlertmanager) Run(ctx context.Context) error {
	moa.logger.Info("Starting MultiOrg Alertmanager")

	for {
		select {
		case <-ctx.Done():
			moa.StopAndWait()
			return nil
		case <-time.After(moa.settingsProvider.Get().UnifiedAlerting.AlertmanagerConfigPollInterval):
			if err := moa.LoadAndSyncAlertmanagersForOrgs(ctx); err != nil {
				moa.logger.Error("Error while synchronizing Alertmanager orgs", "error", err)
			}
		}
	}
}

func (moa *MultiOrgAlertmanager) LoadAndSyncAlertmanagersForOrgs(ctx context.Context) error {
	moa.logger.Debug("Synchronizing Alertmanagers for orgs")
	// First, load all the organizations from the database.
	orgIDs, err := moa.orgStore.FetchOrgIds(ctx)
	if err != nil {
		return err
	}

	// Then, sync them by creating or deleting Alertmanagers as necessary.
	moa.metrics.DiscoveredConfigurations.Set(float64(len(orgIDs)))
	moa.SyncAlertmanagersForOrgs(ctx, orgIDs)

	moa.logger.Debug("Done synchronizing Alertmanagers for orgs")

	return nil
}

// getLatestConfigs retrieves the latest Alertmanager configuration for every organization. It returns a map where the key is the ID of each organization and the value is the configuration.
func (moa *MultiOrgAlertmanager) getLatestConfigs(ctx context.Context) (map[int64]*models.AlertConfiguration, error) {
	configs, err := moa.configStore.GetAllLatestAlertmanagerConfiguration(ctx)
	if err != nil {
		return nil, err
	}

	result := make(map[int64]*models.AlertConfiguration, len(configs))
	for _, config := range configs {
		result[config.OrgID] = config
	}

	return result, nil
}

// SyncAlertmanagersForOrgs syncs configuration of the Alertmanager required by each organization.
func (moa *MultiOrgAlertmanager) SyncAlertmanagersForOrgs(ctx context.Context, orgIDs []int64) {
	orgsFound := make(map[int64]struct{}, len(orgIDs))
	dbConfigs, err := moa.getLatestConfigs(ctx)
	if err != nil {
		moa.logger.Error("Failed to load Alertmanager configurations", "error", err)
		return
	}
	moa.alertmanagersMtx.Lock()
	for _, orgID := range orgIDs {
		if _, isDisabledOrg := moa.settingsProvider.Get().UnifiedAlerting.DisabledOrgs[orgID]; isDisabledOrg {
			moa.logger.Debug("Skipping syncing Alertmanager for disabled org", "org", orgID)
			continue
		}
		orgsFound[orgID] = struct{}{}

		alertmanager, found := moa.alertmanagers[orgID]

		if !found {
			// These metrics are not exported by Grafana and are mostly a placeholder.
			// To export them, we need to translate the metrics from each individual registry and,
			// then aggregate them on the main registry.
			am, err := moa.factory(ctx, orgID)
			if err != nil {
				moa.logger.Error("Unable to create Alertmanager for org", "org", orgID, "error", err)
				continue
			}
			moa.alertmanagers[orgID] = am
			alertmanager = am
		}

		dbConfig, cfgFound := dbConfigs[orgID]
		if !cfgFound {
			if found {
				// This means that the configuration is gone but the organization, as well as the Alertmanager, exists.
				moa.logger.Warn("Alertmanager exists for org but the configuration is gone. Applying the default configuration", "org", orgID)
			}
			err := alertmanager.SaveAndApplyDefaultConfig(ctx)
			if err != nil {
				moa.logger.Error("Failed to apply the default Alertmanager configuration", "org", orgID)
				continue
			}
			moa.alertmanagers[orgID] = alertmanager
			continue
		}

		err := alertmanager.ApplyConfig(ctx, dbConfig)
		if err != nil {
			moa.logger.Error("Failed to apply Alertmanager config for org", "org", orgID, "id", dbConfig.ID, "error", err)
			continue
		}
		moa.alertmanagers[orgID] = alertmanager
	}

	amsToStop := map[int64]Alertmanager{}
	for orgId, am := range moa.alertmanagers {
		if _, exists := orgsFound[orgId]; !exists {
			amsToStop[orgId] = am
			delete(moa.alertmanagers, orgId)
			moa.metrics.RemoveOrgRegistry(orgId)
		}
	}
	moa.metrics.ActiveConfigurations.Set(float64(len(moa.alertmanagers)))
	moa.alertmanagersMtx.Unlock()

	// Now, we can stop the Alertmanagers without having to hold a lock.
	for orgID, am := range amsToStop {
		moa.logger.Info("Stopping Alertmanager", "org", orgID)
		am.StopAndWait()
		moa.logger.Info("Stopped Alertmanager", "org", orgID)
	}

	moa.cleanupOrphanLocalOrgState(ctx, orgsFound)
}

// cleanupOrphanLocalOrgState will remove all orphaned nflog and silence states in kvstore by existing to currently
// active organizations. The original intention for this was the cleanup deleted orgs, that have had their states
// saved to the kvstore after deletion on instance shutdown.
func (moa *MultiOrgAlertmanager) cleanupOrphanLocalOrgState(ctx context.Context,
	activeOrganizations map[int64]struct{},
) {
	storedFiles := []string{NotificationLogFilename, SilencesFilename}
	for _, fileName := range storedFiles {
		keys, err := moa.kvStore.Keys(ctx, kvstore.AllOrganizations, KVNamespace, fileName)
		if err != nil {
			moa.logger.Error("Failed to fetch items from kvstore", "error", err,
				"namespace", KVNamespace, "key", fileName)
		}
		for _, key := range keys {
			if _, exists := activeOrganizations[key.OrgId]; exists {
				continue
			}
			err = moa.kvStore.Del(ctx, key.OrgId, key.Namespace, key.Key)
			if err != nil {
				moa.logger.Error("Failed to delete item from kvstore", "error", err,
					"orgID", key.OrgId, "namespace", KVNamespace, "key", key.Key)
			}
		}
	}
}

func (moa *MultiOrgAlertmanager) StopAndWait() {
	moa.alertmanagersMtx.Lock()
	defer moa.alertmanagersMtx.Unlock()

	for _, am := range moa.alertmanagers {
		am.StopAndWait()
	}

	p, ok := moa.peer.(*alertingCluster.Peer)
	if ok {
		moa.settleCancel()
		if err := p.Leave(10 * time.Second); err != nil {
			moa.logger.Warn("Unable to leave the gossip mesh", "error", err)
		}
	}
	r, ok := moa.peer.(*redisPeer)
	if ok {
		moa.settleCancel()
		r.Shutdown()
	}
}

// AlertmanagerFor returns the Alertmanager instance for the organization provided.
// When the organization does not have an active Alertmanager, it returns a ErrNoAlertmanagerForOrg.
// When the Alertmanager of the organization is not ready, it returns a ErrAlertmanagerNotReady.
func (moa *MultiOrgAlertmanager) AlertmanagerFor(orgID int64) (Alertmanager, error) {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	orgAM, existing := moa.alertmanagers[orgID]
	if !existing {
		return nil, ErrNoAlertmanagerForOrg
	}

	if !orgAM.Ready() {
		return orgAM, ErrAlertmanagerNotReady
	}

	return orgAM, nil
}

// alertmanagerForOrg returns the Alertmanager instance for the organization provided. Should only be called when the
// caller has already locked the alertmanagersMtx.
// TODO: This should eventually replace AlertmanagerFor once the API layer has been refactored to not access the alertmanagers directly
// and AM route error handling has been fully moved to errorutil.
func (moa *MultiOrgAlertmanager) alertmanagerForOrg(orgID int64) (Alertmanager, error) {
	orgAM, existing := moa.alertmanagers[orgID]
	if !existing {
		return nil, WithPublicError(ErrAlertmanagerNotFound.Errorf("Alertmanager does not exist for org %d", orgID))
	}

	if !orgAM.Ready() {
		return nil, WithPublicError(ErrAlertmanagerConflict.Errorf("Alertmanager is not ready for org %d", orgID))
	}

	return orgAM, nil
}

// ListSilences lists silences for the organization provided. Currently, this is a pass-through to the Alertmanager
// implementation.
func (moa *MultiOrgAlertmanager) ListSilences(ctx context.Context, orgID int64, filter []string) ([]*models.Silence, error) {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	orgAM, err := moa.alertmanagerForOrg(orgID)
	if err != nil {
		return nil, err
	}

	silences, err := orgAM.ListSilences(ctx, filter)
	if err != nil {
		if errors.Is(err, alertingNotify.ErrListSilencesBadPayload) {
			return nil, WithPublicError(ErrSilencesBadRequest.Errorf("invalid filters: %w", err))
		}
		return nil, WithPublicError(ErrSilenceInternal.Errorf("failed to list silences: %w", err))
	}
	return GettableSilencesToSilences(silences), nil
}

// GetSilence gets a silence for the organization and silence id provided. Currently, this is a pass-through to the
// Alertmanager implementation.
func (moa *MultiOrgAlertmanager) GetSilence(ctx context.Context, orgID int64, id string) (*models.Silence, error) {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	orgAM, err := moa.alertmanagerForOrg(orgID)
	if err != nil {
		return nil, err
	}

	s, err := orgAM.GetSilence(ctx, id)
	if err != nil {
		if errors.Is(err, alertingNotify.ErrSilenceNotFound) {
			return nil, WithPublicError(ErrSilenceNotFound.Errorf("silence %s not found", id))
		}
		return nil, WithPublicError(ErrSilenceInternal.Errorf("failed to get silence: %w", err))
	}

	return GettableSilenceToSilence(s), nil
}

// CreateSilence creates a silence in the Alertmanager for the organization provided, returning the silence ID. It will
// also persist the silence state to the kvstore immediately after creating the silence.
func (moa *MultiOrgAlertmanager) CreateSilence(ctx context.Context, orgID int64, ps models.Silence) (string, error) {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	orgAM, err := moa.alertmanagerForOrg(orgID)
	if err != nil {
		return "", err
	}

	// Need to create the silence in the AM first to get the silence ID.
	silenceID, err := orgAM.CreateSilence(ctx, SilenceToPostableSilence(ps))
	if err != nil {
		if errors.Is(err, alertingNotify.ErrSilenceNotFound) {
			return "", WithPublicError(ErrSilenceNotFound.Errorf("silence %v not found", ps.ID))
		}

		if errors.Is(err, alertingNotify.ErrCreateSilenceBadPayload) {
			return "", WithPublicError(ErrSilencesBadRequest.Errorf("invalid silence: %w", err))
		}
		return "", WithPublicError(ErrSilenceInternal.Errorf("failed to upsert silence: %w", err))
	}

	err = moa.updateSilenceState(ctx, orgAM, orgID)
	if err != nil {
		moa.logger.Warn("Failed to persist silence state on create, will be corrected by next maintenance run", "orgID", orgID, "silenceID", silenceID, "error", err)
	}

	return silenceID, nil
}

// UpdateSilence updates a silence in the Alertmanager for the organization provided, returning the silence ID. It will
// also persist the silence state to the kvstore immediately after creating the silence.
// Currently, this just calls CreateSilence as the underlying Alertmanager implementation upserts.
func (moa *MultiOrgAlertmanager) UpdateSilence(ctx context.Context, orgID int64, ps models.Silence) (string, error) {
	if ps.ID == nil || *ps.ID == "" { // TODO: Alertmanager interface should probably include a method for updating silences. For now, we leak this implementation detail.
		return "", WithPublicError(ErrSilencesBadRequest.Errorf("silence ID is required"))
	}
	return moa.CreateSilence(ctx, orgID, ps)
}

// DeleteSilence deletes a silence in the Alertmanager for the organization provided. It will also persist the silence
// state to the kvstore immediately after deleting the silence.
func (moa *MultiOrgAlertmanager) DeleteSilence(ctx context.Context, orgID int64, silenceID string) error {
	moa.alertmanagersMtx.RLock()
	defer moa.alertmanagersMtx.RUnlock()

	orgAM, err := moa.alertmanagerForOrg(orgID)
	if err != nil {
		return err
	}

	err = orgAM.DeleteSilence(ctx, silenceID)
	if err != nil {
		if errors.Is(err, alertingNotify.ErrSilenceNotFound) {
			return WithPublicError(ErrSilenceNotFound.Errorf("silence %s not found", silenceID))
		}
		return WithPublicError(ErrSilenceInternal.Errorf("failed to delete silence %s: %w", silenceID, err))
	}

	err = moa.updateSilenceState(ctx, orgAM, orgID)
	if err != nil {
		moa.logger.Warn("Failed to persist silence state on delete, will be corrected by next maintenance run", "orgID", orgID, "silenceID", silenceID, "error", err)
	}

	return nil
}

// updateSilenceState persists the silence state to the kvstore immediately instead of waiting for the next maintenance
// run. This is used after Create/Delete to prevent silences from being lost when a new Alertmanager is started before
// the state has persisted. This can happen, for example, in a rolling deployment scenario.
func (moa *MultiOrgAlertmanager) updateSilenceState(ctx context.Context, orgAM Alertmanager, orgID int64) error {
	// Collect the internal silence state from the AM.
	// TODO: Currently, we rely on the AM itself for the persisted silence state representation. Preferably, we would
	//  define the state ourselves and persist it in a format that is easy to guarantee consistency for writes to
	//  individual silences. In addition to the consistency benefits, this would also allow us to avoid the need for
	//  a network request to the AM to get the state in the case of remote alertmanagers.
	silences, err := orgAM.SilenceState(ctx)
	if err != nil {
		return err
	}

	// Persist to kvstore.
	fs := NewFileStore(orgID, moa.kvStore)
	_, err = fs.SaveSilences(ctx, silences)
	return err
}

// NilPeer and NilChannel implements the Alertmanager clustering interface.
type NilPeer struct{}

func (p *NilPeer) Position() int                   { return 0 }
func (p *NilPeer) WaitReady(context.Context) error { return nil }
func (p *NilPeer) AddState(string, alertingCluster.State, prometheus.Registerer) alertingCluster.ClusterChannel {
	return &NilChannel{}
}

type NilChannel struct{}

func (c *NilChannel) Broadcast([]byte) {}
