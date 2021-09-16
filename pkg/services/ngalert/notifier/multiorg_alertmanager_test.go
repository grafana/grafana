package notifier

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"math"
	"math/rand"
	"sort"
	"strings"
	"testing"
	"time"

	"os"

	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
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
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	cfg := &setting.Cfg{
		DataPath:                       tmpDir,
		AlertmanagerConfigPollInterval: 3 * time.Minute, // do not poll in tests
	}
	mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, m.GetMultiOrgAlertmanagerMetrics(), log.New("testlogger"))
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
		DataPath:                       tmpDir,
		AlertmanagerConfigPollInterval: 3 * time.Minute, // do not poll in tests
	}
	kvStore := newFakeKVStore(t)
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	mam, err := NewMultiOrgAlertmanager(cfg, configStore, orgStore, kvStore, m.GetMultiOrgAlertmanagerMetrics(), log.New("testlogger"))
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

func TestMultiOrgAlertmanager_addOrUpdateConfiguration(t *testing.T) {
	kvStore := newFakeKVStore(t)
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	configStore := &FakeConfigStore{
		configs: map[int64]*models.AlertConfiguration{},
	}

	cfg := &setting.Cfg{DataPath: t.TempDir()}

	mam, initErr := NewMultiOrgAlertmanager(cfg, configStore, nil, kvStore, m.GetMultiOrgAlertmanagerMetrics(), log.New("testlogger"))
	require.NoError(t, initErr)

	t.Run("Adds missing Alertmanager and applies existing configuration", func(t *testing.T) {
		dbConfig := generateFakeAlertConfiguration()
		orgID := dbConfig.OrgID

		//there is no instance of alert manager, but there is a configuration
		err := mam.addOrUpdateAlertmanager(orgID, dbConfig)
		require.NoError(t, err)

		require.Contains(t, mam.alertmanagers, orgID, "AlertManager was not added to the map but it should be")
		require.NotContains(t, configStore.configs, orgID, "The configuration should not be pushed")
	})

	t.Run("Add missing Alertmanager and applies default configuration", func(t *testing.T) {
		orgID := rand.Int63()
		err := mam.addOrUpdateAlertmanager(orgID, nil)
		require.NoError(t, err)

		require.Contains(t, mam.alertmanagers, orgID)
		am := mam.alertmanagers[orgID]
		require.NotNil(t, am.config)

		require.Contains(t, configStore.configs, orgID)
		dbConfig := configStore.configs[orgID]
		require.Equal(t, dbConfig.AlertmanagerConfiguration, alertmanagerDefaultConfiguration)
	})

	t.Run("Updates the existing Alertmanager with the new configuration", func(t *testing.T) {
		dbConfig := generateFakeAlertConfiguration()
		orgID := dbConfig.OrgID

		updErr := mam.addOrUpdateAlertmanager(orgID, nil)
		require.NoError(t, updErr)
		require.Contains(t, mam.alertmanagers, orgID)
		before := mam.alertmanagers[orgID].config.AlertmanagerConfig

		updErr = mam.addOrUpdateAlertmanager(orgID, dbConfig)
		require.NoError(t, updErr)
		after := mam.alertmanagers[orgID].config.AlertmanagerConfig

		require.NotEqual(t, before, after, "the configuration was not applied but should have been")
	})

	t.Run("Resets existing Alertmanager to the default configuration if config is not provided", func(t *testing.T) {
		dbConfig := generateFakeAlertConfiguration()
		orgID := dbConfig.OrgID

		updErr := mam.addOrUpdateAlertmanager(orgID, dbConfig)
		require.NoError(t, updErr)
		require.Contains(t, mam.alertmanagers, orgID)
		before := mam.alertmanagers[orgID].config.AlertmanagerConfig

		updErr = mam.addOrUpdateAlertmanager(orgID, nil)
		require.NoError(t, updErr)
		require.Contains(t, mam.alertmanagers, orgID)
		after := mam.alertmanagers[orgID].config.AlertmanagerConfig

		require.NotEqual(t, before, after, "the configuration was not applied but should have been")
	})
}

func TestSliceInChunks(t *testing.T) {
	orgs := make([]int64, 100)
	for i := 0; i < cap(orgs); i++ {
		orgs[i] = int64(i)
	}
	shuffled := make([]int64, len(orgs))
	copy(shuffled, orgs)
	rand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	chunks := sliceOrgsInChunks(shuffled, 0)
	require.Len(t, chunks, 1)
	require.Equal(t, chunks[0], &models.GetLatestAlertmanagerConfigurationsForManyOrganizationsQuery{MinOrgId: math.MinInt64, MaxOrgId: math.MaxInt64})

	require.False(t, sort.SliceIsSorted(shuffled, func(i, j int) bool {
		return shuffled[i] < shuffled[j]
	}), "The array is not supposed to be sorted on 0 chunk size")

	chunkSize := rand.Intn(3) + 1
	var from int
	max := len(orgs)
	expected := make([]*models.GetLatestAlertmanagerConfigurationsForManyOrganizationsQuery, 0)

	for from < max {
		to := from + chunkSize
		if to > max {
			to = max
		}
		chunk := orgs[from:to]
		q := &models.GetLatestAlertmanagerConfigurationsForManyOrganizationsQuery{MinOrgId: chunk[0], MaxOrgId: chunk[len(chunk)-1]}
		expected = append(expected, q)
		from = to
	}

	chunks = sliceOrgsInChunks(shuffled, int64(chunkSize))
	require.ElementsMatch(t, expected, chunks)

	require.True(t, sort.SliceIsSorted(shuffled, func(i, j int) bool {
		return shuffled[i] < shuffled[j]
	}))
}

func TestMultiOrgAlertmanager_addOrUpdateAlertManagerConfigurations(t *testing.T) {
	orgsToGenerate := 20

	kvStore := newFakeKVStore(t)
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)

	configStore := &FakeConfigStore{
		configs: map[int64]*models.AlertConfiguration{},
	}

	chunkSize := rand.Intn(3) + 2
	cfg := &setting.Cfg{DataPath: t.TempDir(), AlertmanagerConfigChunkSize: uint(chunkSize)}

	mam, initErr := NewMultiOrgAlertmanager(cfg, configStore, nil, kvStore, m.GetMultiOrgAlertmanagerMetrics(), log.New("testlogger"))
	require.NoError(t, initErr)

	orgs := make([]int64, 0, orgsToGenerate)

	for i := 0; i < orgsToGenerate; i++ {
		config := generateFakeAlertConfiguration()
		_, found := configStore.configs[config.OrgID]
		if found {
			i--
			continue
		}
		orgs = append(orgs, config.OrgID)
		configStore.configs[config.OrgID] = config
	}

	sortedOrgs := make([]int64, orgsToGenerate)
	copy(sortedOrgs, orgs)
	sort.Slice(sortedOrgs, func(i, j int) bool {
		return sortedOrgs[i] < sortedOrgs[j]
	})

	chunkRange := make([]*models.GetLatestAlertmanagerConfigurationsForManyOrganizationsQuery, 0, orgsToGenerate/chunkSize)
	var from int
	max := len(sortedOrgs)
	for from < max {
		to := from + chunkSize
		if to > max {
			to = max
		}
		chunk := sortedOrgs[from:to]
		q := &models.GetLatestAlertmanagerConfigurationsForManyOrganizationsQuery{MinOrgId: chunk[0], MaxOrgId: chunk[len(chunk)-1]}
		chunkRange = append(chunkRange, q)
		from = to
	}

	found, err := mam.addOrUpdateAlertManagerConfigurations(context.Background(), orgs)
	require.NoError(t, err)

	for _, org := range sortedOrgs {
		require.Contains(t, found, org)
		require.Contains(t, mam.alertmanagers, org)
	}

	getQueries := make([]*models.GetLatestAlertmanagerConfigurationsForManyOrganizationsQuery, 0, len(chunkRange))

	for _, op := range configStore.opsRecording {
		switch v := op.(type) {
		case *models.GetLatestAlertmanagerConfigurationsForManyOrganizationsQuery:
			getQueries = append(getQueries, v)
		}
	}

	require.ElementsMatch(t, chunkRange, getQueries)
}

func generateFakeAlertConfiguration() *models.AlertConfiguration {
	return &models.AlertConfiguration{
		ID:                        rand.Int63(),
		AlertmanagerConfiguration: strings.Replace(alertmanagerDefaultConfiguration, "grafana-default-email", "grafana-custom-email", -1),
		ConfigurationVersion:      fmt.Sprint(rand.Int()),
		CreatedAt:                 rand.Int63(),
		Default:                   rand.Int()%2 > 0,
		OrgID:                     rand.Int63(),
	}
}

// nolint:unused
func cleanOrgDirectories(path string, t *testing.T) func() {
	return func() {
		require.NoError(t, os.RemoveAll(path))
	}
}
