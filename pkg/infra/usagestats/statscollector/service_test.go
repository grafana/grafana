package statscollector

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/infra/usagestats/validator"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/advisor"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/sandbox"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/services/stats/statstest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestTotalStatsUpdate(t *testing.T) {
	sqlStore := dbtest.NewFakeDB()
	statsService := statstest.NewFakeService()
	s := createService(t, setting.NewCfg(), sqlStore, statsService)
	s.cfg.MetricsEndpointEnabled = true
	s.cfg.MetricsEndpointDisableTotalStats = false

	statsService.ExpectedSystemStats = &stats.SystemStats{}

	tests := []struct {
		MetricsEndpointEnabled           bool
		MetricsEndpointDisableTotalStats bool
		ExpectedUpdate                   bool
	}{
		{
			MetricsEndpointEnabled:           false,
			MetricsEndpointDisableTotalStats: false,
			ExpectedUpdate:                   false,
		},
		{
			MetricsEndpointEnabled:           false,
			MetricsEndpointDisableTotalStats: true,
			ExpectedUpdate:                   false,
		},
		{
			MetricsEndpointEnabled:           true,
			MetricsEndpointDisableTotalStats: true,
			ExpectedUpdate:                   false,
		},
		{
			MetricsEndpointEnabled:           true,
			MetricsEndpointDisableTotalStats: false,
			ExpectedUpdate:                   true,
		},
	}

	for _, tc := range tests {
		tc := tc

		t.Run(fmt.Sprintf(
			"metricsEnabled(%v) * totalStatsDisabled(%v) = %v",
			tc.MetricsEndpointEnabled,
			tc.MetricsEndpointDisableTotalStats,
			tc.ExpectedUpdate,
		), func(t *testing.T) {
			s.cfg.MetricsEndpointEnabled = tc.MetricsEndpointEnabled
			s.cfg.MetricsEndpointDisableTotalStats = tc.MetricsEndpointDisableTotalStats

			assert.Equal(t, tc.ExpectedUpdate, s.updateTotalStats(context.Background()))
		})
	}
}

var _ registry.ProvidesUsageStats = (*dummyUsageStatProvider)(nil)

type dummyUsageStatProvider struct {
	stats map[string]any
}

func (d dummyUsageStatProvider) GetUsageStats(ctx context.Context) map[string]any {
	return d.stats
}

func TestUsageStatsProviders(t *testing.T) {
	provider := &dummyUsageStatProvider{stats: map[string]any{"my_stat_x": "valx", "my_stat_z": "valz"}}

	store := dbtest.NewFakeDB()
	statsService := statstest.NewFakeService()
	mockSystemStats(statsService)
	s := createService(t, setting.NewCfg(), store, statsService)
	s.RegisterProviders([]registry.ProvidesUsageStats{provider})

	report, err := s.usageStats.GetUsageReport(context.Background())
	require.NoError(t, err, "Expected no error")

	assert.Equal(t, "valx", report.Metrics["my_stat_x"])
	assert.Equal(t, "valz", report.Metrics["my_stat_z"])
}

func TestFeatureUsageStats(t *testing.T) {
	store := dbtest.NewFakeDB()
	statsService := statstest.NewFakeService()
	mockSystemStats(statsService)
	s := createService(t, setting.NewCfg(), store, statsService)

	m, err := s.collectSystemStats(context.Background())
	require.NoError(t, err, "Expected no error")

	assert.Equal(t, 1, m["stats.features.feature_1.count"])
	assert.Equal(t, 1, m["stats.features.feature_2.count"])
}

func TestCollectingUsageStats(t *testing.T) {
	sqlStore := dbtest.NewFakeDB()
	statsService := statstest.NewFakeService()
	expectedDataSources := []*datasources.DataSource{
		{
			JsonData: simplejson.NewFromAny(map[string]any{}),
		},
		{
			JsonData: simplejson.NewFromAny(map[string]any{}),
		},
		{
			JsonData: simplejson.NewFromAny(map[string]any{}),
		},
	}

	s := createService(t, &setting.Cfg{
		ReportingEnabled:     true,
		BuildVersion:         "5.0.0",
		Anonymous:            setting.AnonymousSettings{Enabled: true},
		BasicAuthEnabled:     true,
		LDAPAuthEnabled:      true,
		AuthProxy:            setting.AuthProxySettings{Enabled: true},
		Packaging:            "deb",
		ReportingDistributor: "hosted-grafana",
		RemoteCacheOptions: &setting.RemoteCacheSettings{
			Name: "database",
		},
		EnableFrontendSandboxForPlugins: []string{"grafana-worldmap-panel"},
	}, sqlStore, statsService,
		withDatasources(mockDatasourceService{datasources: expectedDataSources}))

	s.startTime = time.Now().Add(-1 * time.Minute)

	mockSystemStats(statsService)

	createConcurrentTokens(t, sqlStore)

	metrics, err := s.collectSystemStats(context.Background())
	require.NoError(t, err)

	assert.EqualValues(t, 15, metrics["stats.total_auth_token.count"])
	assert.EqualValues(t, 2, metrics["stats.api_keys.count"])
	assert.EqualValues(t, 5, metrics["stats.avg_auth_token_per_user.count"])
	assert.EqualValues(t, 16, metrics["stats.dashboard_versions.count"])
	assert.EqualValues(t, 17, metrics["stats.annotations.count"])
	assert.EqualValues(t, 18, metrics["stats.alert_rules.count"])
	assert.EqualValues(t, 19, metrics["stats.library_panels.count"])
	assert.EqualValues(t, 20, metrics["stats.library_variables.count"])

	assert.EqualValues(t, 1, metrics["stats.packaging.deb.count"])
	assert.EqualValues(t, 1, metrics["stats.distributor.hosted-grafana.count"])

	assert.EqualValues(t, 11, metrics["stats.data_keys.count"])
	assert.EqualValues(t, 3, metrics["stats.active_data_keys.count"])
	assert.EqualValues(t, 5, metrics["stats.public_dashboards.count"])
	assert.EqualValues(t, 3, metrics["stats.correlations.count"])

	assert.InDelta(t, int64(65), metrics["stats.uptime"], 6)

	assert.EqualValues(t, 1, metrics["stats.plugins.sandboxed_plugins.count"])
}

func TestDatasourceStats(t *testing.T) {
	sqlStore := dbtest.NewFakeDB()
	statsService := statstest.NewFakeService()
	s := createService(t, &setting.Cfg{}, sqlStore, statsService)

	setupSomeDataSourcePlugins(t, s)

	statsService.ExpectedDataSourceStats = []*stats.DataSourceStats{
		{
			Type:  datasources.DS_ES,
			Count: 9,
		},
		{
			Type:  datasources.DS_PROMETHEUS,
			Count: 10,
		},
		{
			Type:  "unknown_ds",
			Count: 11,
		},
		{
			Type:  "unknown_ds2",
			Count: 12,
		},
	}

	statsService.ExpectedDataSourcesAccessStats = []*stats.DataSourceAccessStats{
		{
			Type:   datasources.DS_ES,
			Access: "direct",
			Count:  1,
		},
		{
			Type:   datasources.DS_ES,
			Access: "proxy",
			Count:  2,
		},
		{
			Type:   datasources.DS_PROMETHEUS,
			Access: "proxy",
			Count:  3,
		},
		{
			Type:   "unknown_ds",
			Access: "proxy",
			Count:  4,
		},
		{
			Type:   "unknown_ds2",
			Access: "",
			Count:  5,
		},
		{
			Type:   "unknown_ds3",
			Access: "direct",
			Count:  6,
		},
		{
			Type:   "unknown_ds4",
			Access: "direct",
			Count:  7,
		},
		{
			Type:   "unknown_ds5",
			Access: "proxy",
			Count:  8,
		},
	}

	{
		db, err := s.collectDatasourceStats(context.Background())
		require.NoError(t, err)

		assert.EqualValues(t, 9, db["stats.ds."+datasources.DS_ES+".count"])
		assert.EqualValues(t, 10, db["stats.ds."+datasources.DS_PROMETHEUS+".count"])
		assert.EqualValues(t, 11+12, db["stats.ds.other.count"])
	}

	{
		dba, err := s.collectDatasourceAccess(context.Background())
		require.NoError(t, err)

		assert.EqualValues(t, 1, dba["stats.ds_access."+datasources.DS_ES+".direct.count"])
		assert.EqualValues(t, 2, dba["stats.ds_access."+datasources.DS_ES+".proxy.count"])
		assert.EqualValues(t, 3, dba["stats.ds_access."+datasources.DS_PROMETHEUS+".proxy.count"])
		assert.EqualValues(t, 6+7, dba["stats.ds_access.other.direct.count"])
		assert.EqualValues(t, 4+8, dba["stats.ds_access.other.proxy.count"])
	}
}

func TestAlertNotifiersStats(t *testing.T) {
	sqlStore := dbtest.NewFakeDB()
	statsService := statstest.NewFakeService()
	s := createService(t, &setting.Cfg{}, sqlStore, statsService)

	statsService.ExpectedNotifierUsageStats = []*stats.NotifierUsageStats{
		{
			Type:  "slack",
			Count: 1,
		},
		{
			Type:  "webhook",
			Count: 2,
		},
	}

	metrics, err := s.collectAlertNotifierStats(context.Background())
	require.NoError(t, err)

	assert.EqualValues(t, 1, metrics["stats.alert_notifiers.slack.count"])
	assert.EqualValues(t, 2, metrics["stats.alert_notifiers.webhook.count"])
}

func mockSystemStats(statsService *statstest.FakeService) {
	statsService.ExpectedSystemStats = &stats.SystemStats{
		Dashboards:                1,
		Datasources:               2,
		Users:                     3,
		Admins:                    31,
		Editors:                   32,
		Viewers:                   33,
		ActiveUsers:               4,
		ActiveAdmins:              21,
		ActiveEditors:             22,
		ActiveViewers:             23,
		ActiveSessions:            24,
		DailyActiveUsers:          25,
		DailyActiveAdmins:         26,
		DailyActiveEditors:        27,
		DailyActiveViewers:        28,
		DailyActiveSessions:       29,
		Orgs:                      5,
		Playlists:                 6,
		Alerts:                    7,
		Stars:                     8,
		Folders:                   9,
		DashboardPermissions:      10,
		FolderPermissions:         11,
		ProvisionedDashboards:     12,
		Snapshots:                 13,
		Teams:                     14,
		AuthTokens:                15,
		DashboardVersions:         16,
		Annotations:               17,
		AlertRules:                18,
		LibraryPanels:             19,
		LibraryVariables:          20,
		DashboardsViewersCanAdmin: 3,
		DashboardsViewersCanEdit:  2,
		FoldersViewersCanAdmin:    1,
		FoldersViewersCanEdit:     5,
		APIKeys:                   2,
		DataKeys:                  11,
		ActiveDataKeys:            3,
		PublicDashboards:          5,
		Correlations:              3,
	}
}

type mockSocial struct {
	social.Service

	OAuthProviders map[string]bool
}

func (m *mockSocial) GetOAuthProviders() map[string]bool {
	return m.OAuthProviders
}

type mockAdvisor struct {
}

func (m *mockAdvisor) ReportSummary(ctx context.Context) (*advisor.ReportInfo, error) {
	return &advisor.ReportInfo{}, nil
}

func setupSomeDataSourcePlugins(t *testing.T, s *Service) {
	t.Helper()

	s.plugins = &pluginstore.FakePluginStore{
		PluginList: []pluginstore.Plugin{
			{JSONData: plugins.JSONData{ID: datasources.DS_ES}, Signature: "internal"},
			{JSONData: plugins.JSONData{ID: datasources.DS_PROMETHEUS}, Signature: "internal"},
			{JSONData: plugins.JSONData{ID: datasources.DS_GRAPHITE}, Signature: "internal"},
			{JSONData: plugins.JSONData{ID: datasources.DS_MYSQL}, Signature: "internal"},
		},
	}
}

func createService(t testing.TB, cfg *setting.Cfg, store db.DB, statsService stats.Service, opts ...func(*serviceOptions)) *Service {
	t.Helper()

	o := &serviceOptions{datasources: mockDatasourceService{}}

	for _, opt := range opts {
		opt(o)
	}

	return ProvideService(
		&usagestats.UsageStatsMock{},
		&validator.FakeUsageStatsValidator{},
		statsService,
		cfg,
		store,
		&mockSocial{},
		&pluginstore.FakePluginStore{},
		featuremgmt.WithManager("feature1", "feature2"),
		o.datasources,
		httpclient.NewProvider(sdkhttpclient.ProviderOptions{Middlewares: []sdkhttpclient.Middleware{}}),
		sandbox.ProvideService(cfg),
		&mockAdvisor{},
	)
}

type serviceOptions struct {
	datasources datasources.DataSourceService
}

func withDatasources(ds datasources.DataSourceService) func(*serviceOptions) {
	return func(options *serviceOptions) {
		options.datasources = ds
	}
}

type mockDatasourceService struct {
	datasources.DataSourceService

	datasources []*datasources.DataSource
}

func (s mockDatasourceService) GetDataSourcesByType(ctx context.Context, query *datasources.GetDataSourcesByTypeQuery) ([]*datasources.DataSource, error) {
	return s.datasources, nil
}

func (s mockDatasourceService) GetHTTPTransport(ctx context.Context, ds *datasources.DataSource, provider httpclient.Provider, customMiddlewares ...sdkhttpclient.Middleware) (http.RoundTripper, error) {
	return provider.GetTransport()
}
