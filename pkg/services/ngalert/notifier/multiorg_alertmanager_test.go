package notifier

import (
	"bytes"
	"context"
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestMultiOrgAlertmanager_SyncAlertmanagersForOrgs(t *testing.T) {
	configStore := &FakeConfigStore{
		configs: map[int64]*models.AlertConfiguration{},
	}
	orgStore := &FakeOrgStore{
		orgs: []int64{1, 2, 3},
	}

	tmpDir, err := ioutil.TempDir("", "test")
	require.NoError(t, err)
	kvStore := newFakeKVStore(t)
	secretsService := secrets.SetupTestService(t)
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
	mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), log.New("testlogger"))
	require.NoError(t, err)
	ctx := context.Background()

	t.Cleanup(cleanOrgDirectories(tmpDir, t))

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
}

func TestMultiOrgAlertmanager_AlertmanagerFor(t *testing.T) {
	configStore := &FakeConfigStore{
		configs: map[int64]*models.AlertConfiguration{},
	}
	orgStore := &FakeOrgStore{
		orgs: []int64{1, 2, 3},
	}
	tmpDir, err := ioutil.TempDir("", "test")
	require.NoError(t, err)
	cfg := &setting.Cfg{
		DataPath:        tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{AlertmanagerConfigPollInterval: 3 * time.Minute, DefaultConfiguration: setting.GetAlertmanagerDefaultConfiguration()}, // do not poll in tests.
	}
	kvStore := newFakeKVStore(t)
	secretsService := secrets.SetupTestService(t)
	decryptFn := secretsService.GetDecryptedValue
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), log.New("testlogger"))
	require.NoError(t, err)
	ctx := context.Background()

	t.Cleanup(cleanOrgDirectories(tmpDir, t))

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

	// Now, let's try to request an Alertmanager that is not ready.
	{
		// let's delete its "running config" to make it non-ready
		mam.alertmanagers[1].config = nil
		_, err := mam.AlertmanagerFor(1)
		require.EqualError(t, err, ErrAlertmanagerNotReady.Error())
	}

	// With an Alertmanager that exists, it responds correctly.
	{
		am, err := mam.AlertmanagerFor(2)
		require.NoError(t, err)
		require.Equal(t, *am.GetStatus().VersionInfo.Version, "N/A")
		require.Equal(t, am.orgID, int64(2))
		require.NotNil(t, am.config)
	}

	// Let's now remove the previous queried organization.
	orgStore.orgs = []int64{1, 3}
	require.NoError(t, mam.LoadAndSyncAlertmanagersForOrgs(ctx))
	{
		_, err := mam.AlertmanagerFor(2)
		require.EqualError(t, err, ErrNoAlertmanagerForOrg.Error())
	}
}

// nolint:unused
func cleanOrgDirectories(path string, t *testing.T) func() {
	return func() {
		require.NoError(t, os.RemoveAll(path))
	}
}
