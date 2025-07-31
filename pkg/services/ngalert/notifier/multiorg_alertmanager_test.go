package notifier

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	alertingNotify "github.com/grafana/alerting/notify"

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
	tmpDir := t.TempDir()
	cfg := &setting.Cfg{
		DataPath: tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 3 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
			DisabledOrgs:                   map[int64]struct{}{5: {}},
		}, // do not poll in tests.
	}
	mam := setupMam(t, cfg)
	reg := mam.metrics.Registerer.(*prometheus.Registry)
	orgStore := mam.orgStore.(*FakeOrgStore)
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
			configs, err := mam.configStore.GetAppliedConfigurations(ctx, org, 10)
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

		// Populate the kvstore with orphaned records.
		err := mam.kvStore.Set(ctx, orgID, KVNamespace, SilencesFilename, "file_1")
		require.NoError(t, err)

		err = mam.kvStore.Set(ctx, orgID, KVNamespace, NotificationLogFilename, "file_1")
		require.NoError(t, err)

		// Now re run the sync job once.
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))

		// The organization kvstore records should be gone by now.
		_, exists, _ := mam.kvStore.Get(ctx, orgID, KVNamespace, SilencesFilename)
		require.False(t, exists)

		_, exists, _ = mam.kvStore.Get(ctx, orgID, KVNamespace, NotificationLogFilename)
		require.False(t, exists)
	}
}

func TestMultiOrgAlertmanager_SyncAlertmanagersForOrgsWithFailures(t *testing.T) {
	mam := setupMam(t, nil)
	ctx := context.Background()

	// Include a broken configuration for organization 2.
	var orgWithBadConfig int64 = 2
	mam.configStore = NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{
		2: {AlertmanagerConfiguration: brokenConfig, OrgID: orgWithBadConfig},
	})

	orgs, err := mam.orgStore.FetchOrgIds(ctx)
	require.NoError(t, err)
	// No successfully applied configurations should be found at first.
	{
		for _, org := range orgs {
			configs, err := mam.configStore.GetAppliedConfigurations(ctx, org, 10)
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
			configs, err := mam.configStore.GetAppliedConfigurations(ctx, org, 10)
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
			configs, err := mam.configStore.GetAppliedConfigurations(ctx, org, 10)
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
		mam.configStore.(*fakeConfigStore).configs = map[int64]*models.AlertConfiguration{} // It'll apply the default config.
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
		require.True(t, mam.alertmanagers[1].Ready())
		require.True(t, mam.alertmanagers[2].Ready())
		require.True(t, mam.alertmanagers[3].Ready())

		// All configurations should be marked as successfully applied.
		for _, org := range orgs {
			configs, err := mam.configStore.GetAppliedConfigurations(ctx, org, 10)
			require.NoError(t, err)
			require.NotEqual(t, 0, len(configs))
		}
	}
}

func TestMultiOrgAlertmanager_AlertmanagerFor(t *testing.T) {
	mam := setupMam(t, nil)
	ctx := context.Background()

	// Ensure that one Alertmanagers is created per org.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
	}

	// First, let's try to request an Alertmanager from an org that doesn't exist.
	{
		_, err := mam.alertmanagerForOrg(5)
		require.ErrorIs(t, err, ErrAlertmanagerNotFound)
	}

	// With an Alertmanager that exists, it responds correctly.
	{
		am, err := mam.alertmanagerForOrg(2)
		require.NoError(t, err)
		internalAm, ok := am.(*alertmanager)
		require.True(t, ok)
		status, err := am.GetStatus(ctx)
		require.NoError(t, err)
		require.Equal(t, "N/A", *status.VersionInfo.Version)
		require.Equal(t, int64(2), internalAm.Base.TenantID())
	}

	// Let's now remove the previous queried organization.
	mam.orgStore.(*FakeOrgStore).orgs = []int64{1, 3}
	require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
	{
		_, err := mam.alertmanagerForOrg(2)
		require.ErrorIs(t, err, ErrAlertmanagerNotFound)
	}
}

func TestMultiOrgAlertmanager_ActivateHistoricalConfiguration(t *testing.T) {
	mam := setupMam(t, nil)
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
	newConfig := `{"template_files":null,"alertmanager_config":{"route":{"receiver":"grafana-default-email","group_by":["grafana_folder","alertname"]},"receivers":[{"name":"grafana-default-email","grafana_managed_receiver_configs":[{"uid":"","name":"some other name","type":"email","disableResolveMessage":false,"settings":{"addresses":"\u003cexample@email.com\u003e"}}]}]}}`
	am, err := mam.alertmanagerForOrg(2)
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
	require.JSONEq(t, defaultConfig, cfgs[2].AlertmanagerConfiguration)
}

func TestMultiOrgAlertmanager_Silences(t *testing.T) {
	mam := setupMam(t, nil)
	ctx := context.Background()

	// Ensure that one Alertmanager is created per org.
	{
		require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
		require.Len(t, mam.alertmanagers, 3)
	}

	am, err := mam.alertmanagerForOrg(1)
	require.NoError(t, err)

	// Confirm no silences.
	silences, err := am.ListSilences(ctx, []string{})
	require.NoError(t, err)
	require.Len(t, silences, 0)

	// Confirm empty state.
	state, err := am.SilenceState(ctx)
	require.NoError(t, err)
	require.Len(t, state, 0)

	// Confirm empty kvstore.
	v, ok, err := mam.kvStore.Get(ctx, 1, KVNamespace, SilencesFilename)
	require.NoError(t, err)
	require.False(t, ok)
	require.Empty(t, v)

	// Create 2 silences.
	gen := models.SilenceGen(models.SilenceMuts.WithEmptyId())
	sid, err := mam.CreateSilence(ctx, 1, gen())
	require.NoError(t, err)
	require.NotEmpty(t, sid)
	sid2, err := mam.CreateSilence(ctx, 1, gen())
	require.NoError(t, err)
	require.NotEmpty(t, sid2)

	// Confirm 2 silences.
	silences, err = am.ListSilences(ctx, []string{})
	require.NoError(t, err)
	require.Len(t, silences, 2)

	// Confirm 2 states.
	state, err = am.SilenceState(ctx)
	require.NoError(t, err)
	require.Len(t, state, 2)

	// Confirm 2 silences in the kvstore.
	v, ok, err = mam.kvStore.Get(ctx, 1, KVNamespace, SilencesFilename)
	require.NoError(t, err)
	require.True(t, ok)
	decoded, err := decode(v)
	require.NoError(t, err)
	state, err = alertingNotify.DecodeState(bytes.NewReader(decoded))
	require.NoError(t, err)
	require.Len(t, state, 2)

	// Delete silence.
	err = mam.DeleteSilence(ctx, 1, sid)
	require.NoError(t, err)

	// Confirm silence is expired in memory.
	silence, err := am.GetSilence(ctx, sid)
	require.NoError(t, err)
	require.EqualValues(t, types.SilenceStateExpired, *silence.Status.State)

	// Confirm silence is expired in kvstore.
	v, ok, err = mam.kvStore.Get(ctx, 1, KVNamespace, SilencesFilename)
	require.NoError(t, err)
	require.True(t, ok)
	decoded, err = decode(v)
	require.NoError(t, err)
	state, err = alertingNotify.DecodeState(bytes.NewReader(decoded))
	require.NoError(t, err)
	require.True(t, time.Now().After(state[sid].Silence.EndsAt)) // Expired.
}

func setupMam(t *testing.T, cfg *setting.Cfg) *MultiOrgAlertmanager {
	if cfg == nil {
		tmpDir := t.TempDir()
		cfg = &setting.Cfg{
			DataPath:        tmpDir,
			UnifiedAlerting: setting.UnifiedAlertingSettings{AlertmanagerConfigPollInterval: 3 * time.Minute, DefaultConfiguration: defaultConfig}, // do not poll in tests.
		}
	}

	cs := NewFakeConfigStore(t, map[int64]*models.AlertConfiguration{})
	orgStore := &FakeOrgStore{
		orgs: []int64{1, 2, 3},
	}
	kvStore := ngfakes.NewFakeKVStore(t)
	provStore := ngfakes.NewFakeProvisioningStore()
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	decryptFn := secretsService.GetDecryptedValue
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	mam, err := NewMultiOrgAlertmanager(
		setting.ProvideService(cfg),
		cs,
		orgStore,
		kvStore,
		provStore,
		decryptFn,
		m.GetMultiOrgAlertmanagerMetrics(),
		nil,
		ngfakes.NewFakeReceiverPermissionsService(),
		log.New("testlogger"),
		secretsService,
		featuremgmt.WithFeatures(),
		nil,
	)
	require.NoError(t, err)
	return mam
}

var defaultConfig = `
{
	"template_files": null,
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email",
			"group_by": [
				"grafana_folder",
				"alertname"
			]
		},
		"receivers": [
			{
				"name": "grafana-default-email",
				"grafana_managed_receiver_configs": [
					{
						"uid": "",
						"name": "email receiver",
						"type": "email",
						"disableResolveMessage": false,
						"settings": {
							"addresses": "\u003cexample@email.com\u003e"
						}
					}
				]
			}
		]
	}
}`

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
				"settings": {
					"addresses": "<example@email.com>"
					"url": "�r_��q/b�����p@ⱎȏ =��@ӹtd>Rú�H��           �;�@Uf��0�\k2*jh�}Íu�)"2�F6]�}r��R�b�d�J;��S퓧��$��",
					"recipient": "#graphana-metrics",
				}
			}]
		}]
	}
}`
