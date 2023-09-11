package notifier

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/alertmanager/cluster"
	"github.com/prometheus/client_golang/prometheus"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
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

type Alertmanager interface {
	// Configuration
	SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error
	SaveAndApplyDefaultConfig(ctx context.Context) error
	GetStatus() (apimodels.GettableStatus, error)

	// Silences
	CreateSilence(*apimodels.PostableSilence) (string, error)
	DeleteSilence(string) error
	GetSilence(string) (apimodels.GettableSilence, error)
	ListSilences([]string) (apimodels.GettableSilences, error)

	// Alerts
	GetAlerts(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error)
	GetAlertGroups(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error)
	PutAlerts(postableAlerts apimodels.PostableAlerts) error

	// Receivers
	GetReceivers(ctx context.Context) ([]apimodels.Receiver, error)
	TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error)
	TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error)
	ApplyConfig(context.Context, *models.AlertConfiguration) error

	// State
	StopAndWait()
	Ready() bool
	FileStore() *FileStore
	OrgID() int64
	ConfigHash() [16]byte
}

type MultiOrgAlertmanager struct {
	Crypto    Crypto
	ProvStore provisioningStore

	alertmanagersMtx sync.RWMutex
	alertmanagers    map[int64]Alertmanager

	settings *setting.Cfg
	logger   log.Logger

	// clusterPeer represents the clustering peers of Alertmanagers between Grafana instances.
	peer         alertingNotify.ClusterPeer
	settleCancel context.CancelFunc

	configStore AlertingStore
	orgStore    store.OrgStore
	kvStore     kvstore.KVStore

	decryptFn alertingNotify.GetDecryptedValueFn

	metrics *metrics.MultiOrgAlertmanager
	ns      notifications.Service
}

func NewMultiOrgAlertmanager(cfg *setting.Cfg, configStore AlertingStore, orgStore store.OrgStore,
	kvStore kvstore.KVStore, provStore provisioningStore, decryptFn alertingNotify.GetDecryptedValueFn,
	m *metrics.MultiOrgAlertmanager, ns notifications.Service, l log.Logger, s secrets.Service,
) (*MultiOrgAlertmanager, error) {
	moa := &MultiOrgAlertmanager{
		Crypto:    NewCrypto(s, configStore, l),
		ProvStore: provStore,

		logger:        l,
		settings:      cfg,
		alertmanagers: map[int64]Alertmanager{},
		configStore:   configStore,
		orgStore:      orgStore,
		kvStore:       kvStore,
		decryptFn:     decryptFn,
		metrics:       m,
		ns:            ns,
		peer:          &NilPeer{},
	}
	if err := moa.setupClustering(cfg); err != nil {
		return nil, err
	}
	return moa, nil
}

func (moa *MultiOrgAlertmanager) setupClustering(cfg *setting.Cfg) error {
	clusterLogger := moa.logger.New("component", "clustering")
	// We set the settlement timeout to be a multiple of the gossip interval,
	// ensuring that a sufficient number of broadcasts have occurred, thereby
	// increasing the probability of success when waiting for the cluster to settle.
	const settleTimeout = cluster.DefaultGossipInterval * 10
	// Redis setup.
	if cfg.UnifiedAlerting.HARedisAddr != "" {
		redisPeer, err := newRedisPeer(redisConfig{
			addr:     cfg.UnifiedAlerting.HARedisAddr,
			name:     cfg.UnifiedAlerting.HARedisPeerName,
			prefix:   cfg.UnifiedAlerting.HARedisPrefix,
			password: cfg.UnifiedAlerting.HARedisPassword,
			username: cfg.UnifiedAlerting.HARedisUsername,
			db:       cfg.UnifiedAlerting.HARedisDB,
			maxConns: cfg.UnifiedAlerting.HARedisMaxConns,
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
		peer, err := cluster.Create(
			clusterLogger,
			moa.metrics.Registerer,
			cfg.UnifiedAlerting.HAListenAddr,
			cfg.UnifiedAlerting.HAAdvertiseAddr,
			cfg.UnifiedAlerting.HAPeers, // peers
			true,
			cfg.UnifiedAlerting.HAPushPullInterval,
			cfg.UnifiedAlerting.HAGossipInterval,
			cluster.DefaultTCPTimeout,
			cluster.DefaultProbeTimeout,
			cluster.DefaultProbeInterval,
			nil,
			true,
			cfg.UnifiedAlerting.HALabel,
		)

		if err != nil {
			return fmt.Errorf("unable to initialize gossip mesh: %w", err)
		}

		err = peer.Join(cluster.DefaultReconnectInterval, cluster.DefaultReconnectTimeout)
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
		case <-time.After(moa.settings.UnifiedAlerting.AlertmanagerConfigPollInterval):
			if err := moa.LoadAndSyncAlertmanagersForOrgs(ctx); err != nil {
				moa.logger.Error("Error while synchronizing Alertmanager orgs", "error", err)
			}
		}
	}
}

func (moa *MultiOrgAlertmanager) LoadAndSyncAlertmanagersForOrgs(ctx context.Context) error {
	moa.logger.Debug("Synchronizing Alertmanagers for orgs")
	// First, load all the organizations from the database.
	orgIDs, err := moa.orgStore.GetOrgs(ctx)
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
		if _, isDisabledOrg := moa.settings.UnifiedAlerting.DisabledOrgs[orgID]; isDisabledOrg {
			moa.logger.Debug("Skipping syncing Alertmanager for disabled org", "org", orgID)
			continue
		}
		orgsFound[orgID] = struct{}{}

		alertmanager, found := moa.alertmanagers[orgID]

		if !found {
			var am Alertmanager
			var err error

			remoteAmCfg := moa.settings.UnifiedAlerting.RemoteAlertmanager
			if remoteAmCfg.Enable {
				// TODO(santiago): remove.
				cfg := ExternalAlertmanagerConfig{
					URL:               remoteAmCfg.URL,
					TenantID:          remoteAmCfg.TenantID,
					BasicAuthPassword: remoteAmCfg.Password,
				}
				am, err = newExternalAlertmanager(cfg, moa.configStore, orgID)
			} else {
				// These metrics are not exported by Grafana and are mostly a placeholder.
				// To export them, we need to translate the metrics from each individual registry and,
				// then aggregate them on the main registry.
				m := metrics.NewAlertmanagerMetrics(moa.metrics.GetOrCreateOrgRegistry(orgID))
				am, err = newAlertmanager(ctx, orgID, moa.settings, moa.configStore, moa.kvStore, moa.peer, moa.decryptFn, moa.ns, m)
			}
			if err != nil {
				moa.logger.Error("Unable to create Alertmanager for org", "org", orgID, "error", err)
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
		// Cleanup all the remaining resources from this alertmanager.
		am.FileStore().CleanUp()
	}

	// We look for orphan directories and remove them. Orphan directories can
	// occur when an organization is deleted and the node running Grafana is
	// shutdown before the next sync is executed.
	moa.cleanupOrphanLocalOrgState(ctx, orgsFound)
}

// cleanupOrphanLocalOrgState will check if there is any organization on
// disk that is not part of the active organizations. If this is the case
// it will delete the local state from disk.
func (moa *MultiOrgAlertmanager) cleanupOrphanLocalOrgState(ctx context.Context,
	activeOrganizations map[int64]struct{}) {
	dataDir := filepath.Join(moa.settings.DataPath, workingDir)
	files, err := os.ReadDir(dataDir)
	if err != nil {
		moa.logger.Error("Failed to list local working directory", "dir", dataDir, "error", err)
		return
	}
	for _, file := range files {
		if !file.IsDir() {
			moa.logger.Warn("Ignoring unexpected file while scanning local working directory", "filename", filepath.Join(dataDir, file.Name()))
			continue
		}
		orgID, err := strconv.ParseInt(file.Name(), 10, 64)
		if err != nil {
			moa.logger.Error("Unable to parse orgID from directory name", "name", file.Name(), "error", err)
			continue
		}
		_, exists := activeOrganizations[orgID]
		if !exists {
			moa.logger.Info("Found orphan organization directory", "orgID", orgID)
			workingDirPath := filepath.Join(dataDir, strconv.FormatInt(orgID, 10))
			fileStore := NewFileStore(orgID, moa.kvStore, workingDirPath)
			// Cleanup all the remaining resources from this alertmanager.
			fileStore.CleanUp()
		}
	}
	// Remove all orphaned items from kvstore by listing all existing items
	// in our used namespace and comparing them to the currently active
	// organizations.
	storedFiles := []string{notificationLogFilename, silencesFilename}
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

	p, ok := moa.peer.(*cluster.Peer)
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

// NilPeer and NilChannel implements the Alertmanager clustering interface.
type NilPeer struct{}

func (p *NilPeer) Position() int                   { return 0 }
func (p *NilPeer) WaitReady(context.Context) error { return nil }
func (p *NilPeer) AddState(string, cluster.State, prometheus.Registerer) cluster.ClusterChannel {
	return &NilChannel{}
}

type NilChannel struct{}

func (c *NilChannel) Broadcast([]byte) {}
