package notifier

import (
	"bytes"
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	ngfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMultiOrgAlertmanager_SyncAlertmanagersForOrgs(t *testing.T) {
	configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{})
	orgStore := &FakeOrgStore{
		orgs: []int64{1, 2, 3},
	}

	tmpDir := t.TempDir()
	kvStore := ngfakes.NewFakeKVStore(t)
	provStore := ngfakes.NewFakeProvisioningStore()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	cfg := &setting.Cfg{
		DataPath: tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 3 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
			DisabledOrgs:                   map[int64]struct{}{5: {}},
		}, // do not poll in tests.
	}
	mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, provStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), nil, log.New("testlogger"), secretsService, &featuremgmt.FeatureManager{})
	require.NoError(t, err)
	ctx := context.Background()

	// Ensure that one Alertmanager is created per org.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
		require.NoError(t, testutil.GatherAndCompare(reg, bytes.NewBufferString(`
# HELP grafana_alerting_active_configurations The number of active Alertmanager configurations.
# TYPE grafana_alerting_active_configurations gauge
grafana_alerting_active_configurations 3
# HELP grafana_alerting_discovered_configurations The number of organizations we've discovered that require an Alertmanager configuration.
# TYPE grafana_alerting_discovered_configurations gauge
grafana_alerting_discovered_configurations 3
`), "grafana_alerting_discovered_configurations", "grafana_alerting_active_configurations"))

		// Configurations should be marked as successfully applied.
		for _, org := range orgStore.orgs {
			configs, err := configStore.GetAppliedConfigurations(ctx, org, 10)
			require.NoError(t, err)
			require.Len(t, configs, 1)
		}
	}
	// When an org is removed, it should detect it.
	{
		orgStore.orgs = []int64{1, 3}
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 2)
		require.NoError(t, testutil.GatherAndCompare(reg, bytes.NewBufferString(`
# HELP grafana_alerting_active_configurations The number of active Alertmanager configurations.
# TYPE grafana_alerting_active_configurations gauge
grafana_alerting_active_configurations 2
# HELP grafana_alerting_discovered_configurations The number of organizations we've discovered that require an Alertmanager configuration.
# TYPE grafana_alerting_discovered_configurations gauge
grafana_alerting_discovered_configurations 2
`), "grafana_alerting_discovered_configurations", "grafana_alerting_active_configurations"))
	}
	// if the org comes back, it should detect it.
	{
		orgStore.orgs = []int64{1, 2, 3, 4}
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 4)
		require.NoError(t, testutil.GatherAndCompare(reg, bytes.NewBufferString(`
# HELP grafana_alerting_active_configurations The number of active Alertmanager configurations.
# TYPE grafana_alerting_active_configurations gauge
grafana_alerting_active_configurations 4
# HELP grafana_alerting_discovered_configurations The number of organizations we've discovered that require an Alertmanager configuration.
# TYPE grafana_alerting_discovered_configurations gauge
grafana_alerting_discovered_configurations 4
`), "grafana_alerting_discovered_configurations", "grafana_alerting_active_configurations"))
	}
	// if the disabled org comes back, it should not detect it.
	{
		orgStore.orgs = []int64{1, 2, 3, 4, 5}
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 4)
	}

	// Orphaned state should be removed.
	{
		orgID := int64(6)
		// First we create a directory and two files for an ograniztation that
		// is not existing in the current state.
		orphanDir := filepath.Join(tmpDir, "alerting", "6")
		err := os.Mkdir(orphanDir, 0750)
		require.NoError(t, err)

		silencesPath := filepath.Join(orphanDir, SilencesFilename)
		err = os.WriteFile(silencesPath, []byte("file_1"), 0644)
		require.NoError(t, err)

		notificationPath := filepath.Join(orphanDir, NotificationLogFilename)
		err = os.WriteFile(notificationPath, []byte("file_2"), 0644)
		require.NoError(t, err)

		// We make sure that both files are on disk.
		info, err := os.Stat(silencesPath)
		require.NoError(t, err)
		require.Equal(t, info.Name(), SilencesFilename)
		info, err = os.Stat(notificationPath)
		require.NoError(t, err)
		require.Equal(t, info.Name(), NotificationLogFilename)

		// We also populate the kvstore with orphaned records.
		err = kvStore.Set(ctx, orgID, KVNamespace, SilencesFilename, "file_1")
		require.NoError(t, err)

		err = kvStore.Set(ctx, orgID, KVNamespace, NotificationLogFilename, "file_1")
		require.NoError(t, err)

		// Now re run the sync job once.
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		// The organization directory should be gone by now.
		_, err = os.Stat(orphanDir)
		require.True(t, errors.Is(err, fs.ErrNotExist))

		// The organization kvstore records should be gone by now.
		_, exists, _ := kvStore.Get(ctx, orgID, KVNamespace, SilencesFilename)
		require.False(t, exists)

		_, exists, _ = kvStore.Get(ctx, orgID, KVNamespace, NotificationLogFilename)
		require.False(t, exists)
	}
}

// TestMultiOrgAlertmanager_SyncAlertmanagersConcurrency verifies that syncing many orgs with a higher
// alertmanager_sync_concurrency is faster than syncing them serially (concurrency=1). Per-org init is
// simulated with a fixed delay in the Alertmanager factory so the difference is dominated by how many
// orgs are initialized at once rather than by I/O noise. The delays are sleeps, so they overlap even on
// a single CPU, making the comparison robust under CI contention.
func TestMultiOrgAlertmanager_SyncAlertmanagersConcurrency(t *testing.T) {
	const (
		numOrgs     = 20
		perOrgDelay = 25 * time.Millisecond
	)

	// timeFirstSync builds a fresh MOA with the given concurrency, where each org's Alertmanager creation
	// is delayed by perOrgDelay, and returns how long the initial load+sync of numOrgs orgs took.
	timeFirstSync := func(t *testing.T, concurrency int) time.Duration {
		t.Helper()

		orgs := make([]int64, numOrgs)
		for i := range orgs {
			orgs[i] = int64(i + 1)
		}

		configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{})
		orgStore := &FakeOrgStore{orgs: orgs}
		kvStore := ngfakes.NewFakeKVStore(t)
		provStore := ngfakes.NewFakeProvisioningStore()
		secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
		decryptFn := secretsService.GetDecryptedValue
		reg := prometheus.NewPedanticRegistry()
		m := metrics.NewNGAlert(reg)
		cfg := &setting.Cfg{
			DataPath: t.TempDir(),
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				AlertmanagerConfigPollInterval: 3 * time.Minute, // do not poll in tests.
				DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
				SyncConcurrency:                concurrency,
			},
		}

		// Simulate expensive per-org initialization by delaying each Alertmanager's creation.
		slowFactory := WithAlertmanagerOverride(func(orig OrgAlertmanagerFactory) OrgAlertmanagerFactory {
			return func(ctx context.Context, orgID int64) (Alertmanager, error) {
				time.Sleep(perOrgDelay)
				return orig(ctx, orgID)
			}
		})

		mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, provStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), nil, log.New("testlogger"), secretsService, &featuremgmt.FeatureManager{}, slowFactory)
		require.NoError(t, err)

		ctx := context.Background()
		start := time.Now()
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		elapsed := time.Since(start)

		require.Len(t, mam.alertmanagers, numOrgs)
		return elapsed
	}

	serial := timeFirstSync(t, 1)
	parallel := timeFirstSync(t, 10)

	t.Logf("syncing %d orgs (per-org delay %s): serial (concurrency=1) took %s, parallel (concurrency=10) took %s (%.1fx faster)",
		numOrgs, perOrgDelay, serial, parallel, float64(serial)/float64(parallel))

	// With 10-way concurrency over 20 delayed initializations the parallel run should be roughly 10x
	// faster. Assert a conservative >2x bound so the test stays robust under load while still failing if
	// the work ever regresses to running serially.
	require.Less(t, parallel, serial/2, "expected concurrent sync to be at least 2x faster than serial")
}

// TestMultiOrgAlertmanager_SyncAlertmanagersForOrgs_PhaseTimings verifies that SyncAlertmanagersForOrgs
// reports the effective concurrency (so the configured value is observable) and populates phase timings.
func TestMultiOrgAlertmanager_SyncAlertmanagersForOrgs_PhaseTimings(t *testing.T) {
	newMam := func(concurrency int) *MultiOrgAlertmanager {
		configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{})
		orgStore := &FakeOrgStore{orgs: []int64{1, 2, 3}}
		kvStore := ngfakes.NewFakeKVStore(t)
		provStore := ngfakes.NewFakeProvisioningStore()
		secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
		reg := prometheus.NewPedanticRegistry()
		m := metrics.NewNGAlert(reg)
		cfg := &setting.Cfg{
			DataPath: t.TempDir(),
			UnifiedAlerting: setting.UnifiedAlertingSettings{
				AlertmanagerConfigPollInterval: 3 * time.Minute,
				DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
				SyncConcurrency:                concurrency,
			},
		}
		mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, provStore, secretsService.GetDecryptedValue, m.GetMultiOrgAlertmanagerMetrics(), nil, log.New("testlogger"), secretsService, &featuremgmt.FeatureManager{})
		require.NoError(t, err)
		return mam
	}

	t.Run("reports the configured concurrency and populates timings", func(t *testing.T) {
		mam := newMam(7)
		timings, err := mam.SyncAlertmanagersForOrgs(context.Background(), []int64{1, 2, 3})
		require.NoError(t, err)
		require.Equal(t, 7, timings.concurrency)
		require.True(t, timings.warmUp, "the first sync is the warm-up")
		require.GreaterOrEqual(t, timings.loadConfigsSeconds, 0.0)
		require.GreaterOrEqual(t, timings.preloadStateSeconds, 0.0)
		require.GreaterOrEqual(t, timings.syncLoopSeconds, 0.0)
		require.GreaterOrEqual(t, timings.factorySeconds, 0.0)
		require.GreaterOrEqual(t, timings.applyConfigSeconds, 0.0)
		require.GreaterOrEqual(t, timings.cleanupSeconds, 0.0)

		// Only the first sync is the warm-up; subsequent syncs mark configs as applied normally.
		timings2, err := mam.SyncAlertmanagersForOrgs(context.Background(), []int64{1, 2, 3})
		require.NoError(t, err)
		require.False(t, timings2.warmUp)
	})

	t.Run("floors non-positive concurrency to 1", func(t *testing.T) {
		timings, err := newMam(0).SyncAlertmanagersForOrgs(context.Background(), []int64{1})
		require.NoError(t, err)
		require.Equal(t, 1, timings.concurrency)
	})
}

func TestMultiOrgAlertmanager_SyncAlertmanagersForOrgsWithFailures(t *testing.T) {
	// Include a broken configuration for organization 2.
	var orgWithBadConfig int64 = 2
	configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{
		2: {AlertmanagerConfiguration: brokenConfig, OrgID: orgWithBadConfig},
	})

	orgs := []int64{1, 2, 3}
	orgStore := &FakeOrgStore{
		orgs: orgs,
	}

	tmpDir := t.TempDir()
	kvStore := ngfakes.NewFakeKVStore(t)
	provStore := ngfakes.NewFakeProvisioningStore()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	cfg := &setting.Cfg{
		DataPath: tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 10 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
		}, // do not poll in tests.
	}
	mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, provStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), nil, log.New("testlogger"), secretsService, &featuremgmt.FeatureManager{})
	require.NoError(t, err)
	ctx := context.Background()

	// No successfully applied configurations should be found at first.
	{
		for _, org := range orgs {
			configs, err := configStore.GetAppliedConfigurations(ctx, org, 10)
			require.NoError(t, err)
			require.Len(t, configs, 0)
		}
	}

	// When you sync the first time, the alertmanager is created but is doesn't become ready until you have a configuration applied.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
		require.True(t, mam.alertmanagers[1].Ready())
		require.False(t, mam.alertmanagers[2].Ready())
		require.True(t, mam.alertmanagers[3].Ready())

		// Configurations should be marked as successfully applied for all orgs except for org 2.
		for _, org := range orgs {
			configs, err := configStore.GetAppliedConfigurations(ctx, org, 10)
			require.NoError(t, err)
			if org == orgWithBadConfig {
				require.Len(t, configs, 0)
			} else {
				require.Len(t, configs, 1)
			}
		}
	}

	// On the next sync, it never panics and alertmanager is still not ready.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
		require.True(t, mam.alertmanagers[1].Ready())
		require.False(t, mam.alertmanagers[2].Ready())
		require.True(t, mam.alertmanagers[3].Ready())

		// The configuration should still be marked as successfully applied for all orgs except for org 2.
		for _, org := range orgs {
			configs, err := configStore.GetAppliedConfigurations(ctx, org, 10)
			require.NoError(t, err)
			if org == orgWithBadConfig {
				require.Len(t, configs, 0)
			} else {
				require.Len(t, configs, 1)
			}
		}
	}

	// If we fix the configuration, it becomes ready.
	{
		configStore.configs = map[int64]*models.AlertConfiguration{} // It'll apply the default config.
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
		require.True(t, mam.alertmanagers[1].Ready())
		require.True(t, mam.alertmanagers[2].Ready())
		require.True(t, mam.alertmanagers[3].Ready())

		// All configurations should be marked as successfully applied.
		for _, org := range orgs {
			configs, err := configStore.GetAppliedConfigurations(ctx, org, 10)
			require.NoError(t, err)
			require.NotEqual(t, 0, len(configs))
		}
	}
}

func TestMultiOrgAlertmanager_AlertmanagerFor(t *testing.T) {
	configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{})
	orgStore := &FakeOrgStore{
		orgs: []int64{1, 2, 3},
	}
	tmpDir := t.TempDir()
	cfg := &setting.Cfg{
		DataPath:        tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{AlertmanagerConfigPollInterval: 3 * time.Minute, DefaultConfiguration: setting.GetAlertmanagerDefaultConfiguration()}, // do not poll in tests.
	}
	kvStore := ngfakes.NewFakeKVStore(t)
	provStore := ngfakes.NewFakeProvisioningStore()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, provStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), nil, log.New("testlogger"), secretsService, &featuremgmt.FeatureManager{})
	require.NoError(t, err)
	ctx := context.Background()

	// Ensure that one Alertmanagers is created per org.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
	}

	// First, let's try to request an Alertmanager from an org that doesn't exist.
	{
		_, err := mam.AlertmanagerFor(5)
		require.EqualError(t, err, ErrNoAlertmanagerForOrg.Error())
	}

	// With an Alertmanager that exists, it responds correctly.
	{
		am, err := mam.AlertmanagerFor(2)
		require.NoError(t, err)
		internalAm, ok := am.(*alertmanager)
		require.True(t, ok)
		require.Equal(t, "N/A", *am.GetStatus().VersionInfo.Version)
		require.Equal(t, int64(2), internalAm.orgID)
	}

	// Let's now remove the previous queried organization.
	orgStore.orgs = []int64{1, 3}
	require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
	{
		_, err := mam.AlertmanagerFor(2)
		require.EqualError(t, err, ErrNoAlertmanagerForOrg.Error())
	}
}

func TestMultiOrgAlertmanager_ActivateHistoricalConfiguration(t *testing.T) {
	configStore := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{})
	orgStore := &FakeOrgStore{
		orgs: []int64{1, 2, 3},
	}
	tmpDir := t.TempDir()
	defaultConfig := `{"template_files":null,"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"email receiver","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"},"secureSettings":null}]}]}}`
	cfg := &setting.Cfg{
		DataPath:        tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{AlertmanagerConfigPollInterval: 3 * time.Minute, DefaultConfiguration: defaultConfig}, // do not poll in tests.
	}
	kvStore := ngfakes.NewFakeKVStore(t)
	provStore := ngfakes.NewFakeProvisioningStore()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, provStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), nil, log.New("testlogger"), secretsService, &featuremgmt.FeatureManager{})
	require.NoError(t, err)
	ctx := context.Background()

	// Ensure that one Alertmanager is created per org.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
	}

	// First, let's confirm the default configs are active.
	cfgs, err := mam.getLatestConfigs(ctx)
	require.NoError(t, err)
	require.Equal(t, defaultConfig, cfgs[1].AlertmanagerConfiguration)
	require.Equal(t, defaultConfig, cfgs[2].AlertmanagerConfiguration)
	// Store id for later use.
	originalId := cfgs[2].ID
	require.Equal(t, defaultConfig, cfgs[3].AlertmanagerConfiguration)

	// Now let's save a new config for org 2.
	newConfig := `{"template_files":null,"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"templates":null,"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"some other name","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"},"secureSettings":null}]}]}}`
	am, err := mam.AlertmanagerFor(2)
	require.NoError(t, err)

	postable, err := Load([]byte(newConfig))
	require.NoError(t, err)

	err = am.SaveAndApplyConfig(ctx, postable)
	require.NoError(t, err)

	// Verify that the org has the new config.
	cfgs, err = mam.getLatestConfigs(ctx)
	require.NoError(t, err)
	require.Equal(t, newConfig, cfgs[2].AlertmanagerConfiguration)

	// First, let's try to activate a historical alertmanager config that doesn't exist.
	{
		err := mam.ActivateHistoricalConfiguration(ctx, 1, 42)
		require.Error(t, err, store.ErrNoAlertmanagerConfiguration)
	}

	// Finally, we activate the default config for org 2.
	{
		err := mam.ActivateHistoricalConfiguration(ctx, 2, originalId)
		require.NoError(t, err)
	}

	// Verify that the org has the old default config.
	cfgs, err = mam.getLatestConfigs(ctx)
	require.NoError(t, err)
	require.Equal(t, defaultConfig, cfgs[2].AlertmanagerConfiguration)
}

var brokenConfig = `
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "slack receiver",
				"type": "slack",
				"isDefault": true,
				"settings": {
					"addresses": "<example@email.com>"
					"url": "�r_��q/b�����p@ⱎȏ =��@ӹtd>Rú�H��           �;�@Uf��0�\k2*jh�}Íu�)"2�F6]�}r��R�b�d�J;��S퓧��$��",
					"recipient": "#graphana-metrics",
				}
			}]
		}]
	}
}`
