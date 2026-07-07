package notifier

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	alertingCluster "github.com/grafana/alerting/cluster"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/sync/errgroup"

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

//go:generate mockery --name Alertmanager --structname AlertmanagerMock --with-expecter --output alertmanager_mock --outpkg alertmanager_mock
type Alertmanager interface {
	// Configuration
	ApplyConfig(context.Context, *models.AlertConfiguration) error
	SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error
	SaveAndApplyDefaultConfig(ctx context.Context) error
	GetStatus() apimodels.GettableStatus

	// Silences
	CreateSilence(context.Context, *apimodels.PostableSilence) (string, error)
	DeleteSilence(context.Context, string) error
	GetSilence(context.Context, string) (apimodels.GettableSilence, error)
	ListSilences(context.Context, []string) (apimodels.GettableSilences, error)

	// Alerts
	GetAlerts(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error)
	GetAlertGroups(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error)
	PutAlerts(context.Context, apimodels.PostableAlerts) error

	// Receivers
	GetReceivers(ctx context.Context) ([]apimodels.Receiver, error)
	TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error)
	TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error)

	// State
	CleanUp()
	StopAndWait()
	Ready() bool
}

type MultiOrgAlertmanager struct {
	Crypto    Crypto
	ProvStore provisioningStore

	alertmanagersMtx sync.RWMutex
	alertmanagers    map[int64]Alertmanager

	// warmedUp is false until the first sync completes; the warm-up sync does extra work — see
	// SyncAlertmanagersForOrgs.
	warmedUp atomic.Bool

	settings       *setting.Cfg
	featureManager featuremgmt.FeatureToggles
	logger         log.Logger

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
}

type OrgAlertmanagerFactory func(ctx context.Context, orgID int64) (Alertmanager, error)

type Option func(*MultiOrgAlertmanager)

func WithAlertmanagerOverride(f func(OrgAlertmanagerFactory) OrgAlertmanagerFactory) Option {
	return func(moa *MultiOrgAlertmanager) {
		moa.factory = f(moa.factory)
	}
}

func NewMultiOrgAlertmanager(
	cfg *setting.Cfg,
	configStore AlertingStore,
	orgStore store.OrgStore,
	kvStore kvstore.KVStore,
	provStore provisioningStore,
	decryptFn alertingNotify.GetDecryptedValueFn,
	m *metrics.MultiOrgAlertmanager,
	ns notifications.Service,
	l log.Logger,
	s secrets.Service,
	featureManager featuremgmt.FeatureToggles,
	opts ...Option,
) (*MultiOrgAlertmanager, error) {
	moa := &MultiOrgAlertmanager{
		Crypto:    NewCrypto(s, configStore, l),
		ProvStore: provStore,

		logger:         l,
		settings:       cfg,
		featureManager: featureManager,
		alertmanagers:  map[int64]Alertmanager{},
		configStore:    configStore,
		orgStore:       orgStore,
		kvStore:        kvStore,
		decryptFn:      decryptFn,
		metrics:        m,
		ns:             ns,
		peer:           &NilPeer{},
	}

	if err := moa.setupClustering(cfg); err != nil {
		return nil, err
	}

	// Set up the default per tenant Alertmanager factory.
	moa.factory = func(ctx context.Context, orgID int64) (Alertmanager, error) {
		m := metrics.NewAlertmanagerMetrics(moa.metrics.GetOrCreateOrgRegistry(orgID))
		return NewAlertmanager(ctx, orgID, moa.settings, moa.configStore, moa.kvStore, moa.peer, moa.decryptFn, moa.ns, m, featureManager.IsEnabled(ctx, featuremgmt.FlagAlertingSimplifiedRouting))
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

		err = peer.Join(alertingCluster.DefaultReconnectInterval, alertingCluster.DefaultReconnectTimeout)
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
	startTime := time.Now() // LOGZ.IO GRAFANA CHANGE :: AI-40 - Add observability to alertmanagers load time
	moa.logger.Debug("Synchronizing Alertmanagers for orgs")
	// First, load all the organizations from the database.
	orgIDs, err := moa.orgStore.GetOrgs(ctx)
	if err != nil {
		return err
	}

	// Then, sync them by creating or deleting Alertmanagers as necessary.
	moa.metrics.DiscoveredConfigurations.Set(float64(len(orgIDs)))
	timings, err := moa.SyncAlertmanagersForOrgs(ctx, orgIDs)

	// LOGZ.IO GRAFANA CHANGE :: AI-40 - Add observability to alertmanagers load time
	loadingTime := time.Since(startTime).Seconds()
	moa.metrics.SyncAlertmanagersTimeSeconds.Set(loadingTime)
	if err != nil {
		// Failure already logged in SyncAlertmanagersForOrgs; skip the misleading "Done" line.
		// Return nil to preserve the existing non-fatal behavior on the init/poll paths.
		return nil
	}
	moa.logger.Info("Done synchronizing Alertmanagers for orgs",
		"org_count", len(orgIDs),
		"duration_seconds", loadingTime,
		"load_configs_seconds", timings.loadConfigsSeconds,
		"preload_state_seconds", timings.preloadStateSeconds,
		"sync_loop_seconds", timings.syncLoopSeconds,
		"factory_seconds_total", timings.factorySeconds,
		"apply_config_seconds_total", timings.applyConfigSeconds,
		"cleanup_seconds", timings.cleanupSeconds,
		"concurrency", timings.concurrency,
		"warmup", timings.warmUp,
	)
	// LOGZ.IO GRAFANA CHANGE :: End

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

// syncPhaseTimings breaks down where a sync spends time so the dominant phase (config load,
// the per-org sync loop, or orphan cleanup) is visible in the completion log.
type syncPhaseTimings struct {
	loadConfigsSeconds  float64
	preloadStateSeconds float64
	syncLoopSeconds     float64
	cleanupSeconds      float64
	concurrency         int
	warmUp              bool
	// factorySeconds and applyConfigSeconds are aggregate work-seconds summed across all concurrent
	// workers (so they exceed wall-clock); their ratio shows which step dominates the sync loop, and
	// each divided by concurrency approximates its wall-clock contribution.
	factorySeconds     float64
	applyConfigSeconds float64
}

// SyncAlertmanagersForOrgs syncs configuration of the Alertmanager required by each organization.
func (moa *MultiOrgAlertmanager) SyncAlertmanagersForOrgs(ctx context.Context, orgIDs []int64) (syncPhaseTimings, error) {
	var timings syncPhaseTimings
	orgsFound := make(map[int64]struct{}, len(orgIDs))
	loadConfigsStart := time.Now()
	dbConfigs, err := moa.getLatestConfigs(ctx)
	if err != nil {
		moa.logger.Error("Failed to load Alertmanager configurations", "error", err)
		return timings, err
	}
	timings.loadConfigsSeconds = time.Since(loadConfigsStart).Seconds()

	// The first (warm-up) sync is the only one that constructs an Alertmanager for every org, and it's
	// where startup cost concentrates. Two things happen only on that sync:
	//  1. Bulk-load all orgs' file state in one query so the factory hydrates from memory instead of a
	//     per-org kvstore read (the factory reads it via FilepathFor). Later polls construct AMs only for
	//     genuinely new orgs, which fall back to a per-org read, so bulk-loading on every poll would just
	//     build a map nothing reads. Falls back to per-org reads if the bulk load fails.
	//  2. Skip MarkConfigurationAsApplied: a fresh Alertmanager makes every config look "changed", so each
	//     org would issue a DB write for a config that didn't actually change — a per-org write storm.
	//     Steady-state polls only mark genuine changes, so they're unaffected.
	timings.warmUp = moa.warmedUp.CompareAndSwap(false, true)
	if timings.warmUp {
		preloadStart := time.Now()
		if fileState, err := moa.kvStore.GetAll(ctx, kvstore.AllOrganizations, KVNamespace); err != nil {
			moa.logger.Warn("Failed to bulk-load Alertmanager file state; falling back to per-org reads", "error", err)
		} else {
			ctx = WithPreloadedFileState(ctx, fileState)
		}
		timings.preloadStateSeconds = time.Since(preloadStart).Seconds()

		ctx = WithSkipMarkConfigApplied(ctx)
	}

	// Snapshot the running Alertmanagers under a read lock so the per-org work below can run concurrently
	// without holding the lock. This method is the only writer of moa.alertmanagers and runs serially.
	moa.alertmanagersMtx.RLock()
	existing := make(map[int64]Alertmanager, len(moa.alertmanagers))
	for orgID, am := range moa.alertmanagers {
		existing[orgID] = am
	}
	moa.alertmanagersMtx.RUnlock()

	// Determine which orgs to sync, skipping disabled ones.
	syncOrgs := make([]int64, 0, len(orgIDs))
	for _, orgID := range orgIDs {
		if _, isDisabledOrg := moa.settings.UnifiedAlerting.DisabledOrgs[orgID]; isDisabledOrg {
			moa.logger.Debug("Skipping syncing Alertmanager for disabled org", "org", orgID)
			continue
		}
		orgsFound[orgID] = struct{}{}
		syncOrgs = append(syncOrgs, orgID)
	}

	// Each goroutine writes its result into its own index-aligned slot, so no locking is needed here.
	// Failures are logged and leave a nil slot, preserving the previous "log and skip" behavior.
	synced := make([]Alertmanager, len(syncOrgs))
	var g errgroup.Group
	// SetLimit(0) would block every goroutine forever; floor it (a Cfg may be built without ReadUnifiedAlertingSettings).
	concurrency := moa.settings.UnifiedAlerting.SyncConcurrency
	if concurrency < 1 {
		concurrency = 1
	}
	timings.concurrency = concurrency
	g.SetLimit(concurrency)
	// Aggregate per-org time in the two heavy steps (summed across workers) to reveal which dominates.
	var factoryNanos, applyConfigNanos atomic.Int64
	loopStart := time.Now()
	for i, orgID := range syncOrgs {
		i, orgID := i, orgID
		g.Go(func() error {
			alertmanager, alertmanagerFound := existing[orgID]
			if !alertmanagerFound {
				// These metrics are not exported by Grafana and are mostly a placeholder.
				// To export them, we need to translate the metrics from each individual registry and,
				// then aggregate them on the main registry.
				factoryStart := time.Now()
				am, err := moa.factory(ctx, orgID)
				factoryNanos.Add(int64(time.Since(factoryStart)))
				if err != nil {
					moa.logger.Error("Unable to create Alertmanager for org", "org", orgID, "error", err)
					return nil // synced[i] stays nil: a failed factory means the org is not registered.
				}
				alertmanager = am
			}
			// Register the AM before applying config: a failed apply must still leave it (not-ready) in the map.
			synced[i] = alertmanager

			applyStart := time.Now()
			defer func() { applyConfigNanos.Add(int64(time.Since(applyStart))) }()

			dbConfig, cfgFound := dbConfigs[orgID]
			if !cfgFound {
				if alertmanagerFound {
					// This means that the configuration is gone but the organization, as well as the Alertmanager, exists.
					moa.logger.Warn("Alertmanager exists for org but the configuration is gone. Applying the default configuration", "org", orgID)
				}
				if err := alertmanager.SaveAndApplyDefaultConfig(ctx); err != nil {
					moa.logger.Error("Failed to apply the default Alertmanager configuration", "org", orgID)
				}
				return nil
			}

			if err := alertmanager.ApplyConfig(ctx, dbConfig); err != nil {
				moa.logger.Error("Failed to apply Alertmanager config for org", "org", orgID, "id", dbConfig.ID, "error", err)
			}
			return nil
		})
	}
	_ = g.Wait() // goroutines never return an error; failures are logged above and the org is skipped.
	timings.syncLoopSeconds = time.Since(loopStart).Seconds()
	timings.factorySeconds = float64(factoryNanos.Load()) / float64(time.Second)
	timings.applyConfigSeconds = float64(applyConfigNanos.Load()) / float64(time.Second)

	// Merge results and prune removed orgs under the write lock. This phase is fast and does no I/O.
	moa.alertmanagersMtx.Lock()
	for i, orgID := range syncOrgs {
		if synced[i] != nil {
			moa.alertmanagers[orgID] = synced[i]
		}
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

	cleanupStart := time.Now()
	// Now, we can stop the Alertmanagers without having to hold a lock.
	for orgID, am := range amsToStop {
		moa.logger.Info("Stopping Alertmanager", "org", orgID)
		am.StopAndWait()
		moa.logger.Info("Stopped Alertmanager", "org", orgID)
		// Clean up all the remaining resources from this alertmanager.
		am.CleanUp()
	}

	// We look for orphan directories and remove them. Orphan directories can
	// occur when an organization is deleted and the node running Grafana is
	// shutdown before the next sync is executed.
	moa.cleanupOrphanLocalOrgState(ctx, orgsFound)
	timings.cleanupSeconds = time.Since(cleanupStart).Seconds()

	return timings, nil
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
			// Clean up all the remaining resources from this alertmanager.
			fileStore.CleanUp()
		}
	}
	// Remove all orphaned items from kvstore by listing all existing items
	// in our used namespace and comparing them to the currently active
	// organizations.
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

// NilPeer and NilChannel implements the Alertmanager clustering interface.
type NilPeer struct{}

func (p *NilPeer) Position() int                   { return 0 }
func (p *NilPeer) WaitReady(context.Context) error { return nil }
func (p *NilPeer) AddState(string, alertingCluster.State, prometheus.Registerer) alertingCluster.ClusterChannel {
	return &NilChannel{}
}

type NilChannel struct{}

func (c *NilChannel) Broadcast([]byte) {}
