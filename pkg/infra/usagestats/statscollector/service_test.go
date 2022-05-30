package statscollector

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestTotalStatsUpdate(t *testing.T) {
	sqlStore := mockstore.NewSQLStoreMock()
	s := createService(t, setting.NewCfg(), sqlStore)
	s.cfg.MetricsEndpointEnabled = true
	s.cfg.MetricsEndpointDisableTotalStats = false

	sqlStore.ExpectedSystemStats = &models.SystemStats{}

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
	stats map[string]interface{}
}

func (d dummyUsageStatProvider) GetUsageStats(ctx context.Context) map[string]interface{} {
	return d.stats
}

func TestUsageStatsProviders(t *testing.T) {
	provider1 := &dummyUsageStatProvider{stats: map[string]interface{}{"my_stat_1": "val1", "my_stat_2": "val2"}}
	provider2 := &dummyUsageStatProvider{stats: map[string]interface{}{"my_stat_x": "valx", "my_stat_z": "valz"}}

	store := mockstore.NewSQLStoreMock()
	mockSystemStats(store)
	s := createService(t, setting.NewCfg(), store)
	s.RegisterProviders([]registry.ProvidesUsageStats{provider1, provider2})

	m, err := s.collect(context.Background())
	require.NoError(t, err, "Expected no error")

	assert.Equal(t, "val1", m["my_stat_1"])
	assert.Equal(t, "val2", m["my_stat_2"])
	assert.Equal(t, "valx", m["my_stat_x"])
	assert.Equal(t, "valz", m["my_stat_z"])
}

func TestFeatureUsageStats(t *testing.T) {
	store := mockstore.NewSQLStoreMock()
	mockSystemStats(store)
	s := createService(t, setting.NewCfg(), store)

	m, err := s.collect(context.Background())
	require.NoError(t, err, "Expected no error")

	assert.Equal(t, 1, m["stats.features.feature_1.count"])
	assert.Equal(t, 1, m["stats.features.feature_2.count"])
}

func TestCollectingUsageStats(t *testing.T) {
	sqlStore := mockstore.NewSQLStoreMock()
	s := createService(t, &setting.Cfg{
		ReportingEnabled:     true,
		BuildVersion:         "5.0.0",
		AnonymousEnabled:     true,
		BasicAuthEnabled:     true,
		LDAPEnabled:          true,
		AuthProxyEnabled:     true,
		Packaging:            "deb",
		ReportingDistributor: "hosted-grafana",
	}, sqlStore)

	s.startTime = time.Now().Add(-1 * time.Minute)

	mockSystemStats(sqlStore)
	setupSomeDataSourcePlugins(t, s)

	sqlStore.ExpectedDataSourceStats = []*models.DataSourceStats{
		{
			Type:  models.DS_ES,
			Count: 9,
		},
		{
			Type:  models.DS_PROMETHEUS,
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

	sqlStore.ExpectedDataSources = []*models.DataSource{
		{
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"esVersion": 2,
			}),
		},
		{
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"esVersion": 2,
			}),
		},
		{
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"esVersion": 70,
			}),
		},
	}

	sqlStore.ExpectedDataSourcesAccessStats = []*models.DataSourceAccessStats{
		{
			Type:   models.DS_ES,
			Access: "direct",
			Count:  1,
		},
		{
			Type:   models.DS_ES,
			Access: "proxy",
			Count:  2,
		},
		{
			Type:   models.DS_PROMETHEUS,
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

	sqlStore.ExpectedNotifierUsageStats = []*models.NotifierUsageStats{
		{
			Type:  "slack",
			Count: 1,
		},
		{
			Type:  "webhook",
			Count: 2,
		},
	}

	createConcurrentTokens(t, sqlStore)

	s.social = &mockSocial{
		OAuthProviders: map[string]bool{
			"github":        true,
			"gitlab":        true,
			"azuread":       true,
			"google":        true,
			"generic_oauth": true,
			"grafana_com":   true,
		},
	}

	metrics, err := s.collect(context.Background())
	require.NoError(t, err)

	assert.EqualValues(t, 15, metrics["stats.total_auth_token.count"])
	assert.EqualValues(t, 2, metrics["stats.api_keys.count"])
	assert.EqualValues(t, 5, metrics["stats.avg_auth_token_per_user.count"])
	assert.EqualValues(t, 16, metrics["stats.dashboard_versions.count"])
	assert.EqualValues(t, 17, metrics["stats.annotations.count"])
	assert.EqualValues(t, 18, metrics["stats.alert_rules.count"])
	assert.EqualValues(t, 19, metrics["stats.library_panels.count"])
	assert.EqualValues(t, 20, metrics["stats.library_variables.count"])

	assert.EqualValues(t, 9, metrics["stats.ds."+models.DS_ES+".count"])
	assert.EqualValues(t, 10, metrics["stats.ds."+models.DS_PROMETHEUS+".count"])

	assert.EqualValues(t, 11+12, metrics["stats.ds.other.count"])

	assert.EqualValues(t, 1, metrics["stats.ds_access."+models.DS_ES+".direct.count"])
	assert.EqualValues(t, 2, metrics["stats.ds_access."+models.DS_ES+".proxy.count"])
	assert.EqualValues(t, 3, metrics["stats.ds_access."+models.DS_PROMETHEUS+".proxy.count"])
	assert.EqualValues(t, 6+7, metrics["stats.ds_access.other.direct.count"])
	assert.EqualValues(t, 4+8, metrics["stats.ds_access.other.proxy.count"])

	assert.EqualValues(t, 1, metrics["stats.alert_notifiers.slack.count"])
	assert.EqualValues(t, 2, metrics["stats.alert_notifiers.webhook.count"])

	assert.EqualValues(t, 1, metrics["stats.auth_enabled.anonymous.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.basic_auth.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.ldap.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.auth_proxy.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.oauth_github.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.oauth_gitlab.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.oauth_google.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.oauth_azuread.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.oauth_generic_oauth.count"])
	assert.EqualValues(t, 1, metrics["stats.auth_enabled.oauth_grafana_com.count"])

	assert.EqualValues(t, 1, metrics["stats.packaging.deb.count"])
	assert.EqualValues(t, 1, metrics["stats.distributor.hosted-grafana.count"])

	assert.EqualValues(t, 11, metrics["stats.data_keys.count"])
	assert.EqualValues(t, 3, metrics["stats.active_data_keys.count"])

	assert.InDelta(t, int64(65), metrics["stats.uptime"], 6)
}

func mockSystemStats(sqlStore *mockstore.SQLStoreMock) {
	sqlStore.ExpectedSystemStats = &models.SystemStats{
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
	}
}

type mockSocial struct {
	social.Service

	OAuthProviders map[string]bool
}

func (m *mockSocial) GetOAuthProviders() map[string]bool {
	return m.OAuthProviders
}

type fakePluginStore struct {
	plugins.Store

	plugins map[string]plugins.PluginDTO
}

func (pr fakePluginStore) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := pr.plugins[pluginID]

	return p, exists
}

func setupSomeDataSourcePlugins(t *testing.T, s *Service) {
	t.Helper()

	s.plugins = &fakePluginStore{
		plugins: map[string]plugins.PluginDTO{
			models.DS_ES: {
				Signature: "internal",
			},
			models.DS_PROMETHEUS: {
				Signature: "internal",
			},
			models.DS_GRAPHITE: {
				Signature: "internal",
			},
			models.DS_MYSQL: {
				Signature: "internal",
			},
		},
	}
}

func (pr fakePluginStore) Plugins(_ context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	var result []plugins.PluginDTO
	for _, v := range pr.plugins {
		for _, t := range pluginTypes {
			if v.Type == t {
				result = append(result, v)
			}
		}
	}

	return result
}

func createService(t testing.TB, cfg *setting.Cfg, store sqlstore.Store, opts ...func(*serviceOptions)) *Service {
	t.Helper()

	o := &serviceOptions{datasources: mockDatasourceService{}}

	for _, opt := range opts {
		opt(o)
	}

	return ProvideService(
		&usagestats.UsageStatsMock{},
		cfg,
		store,
		&mockSocial{},
		&fakePluginStore{},
		featuremgmt.WithFeatures("feature1", "feature2"),
		o.datasources,
		httpclient.NewProvider(),
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

	datasources []*models.DataSource
}

func (s mockDatasourceService) GetDataSourcesByType(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error {
	query.Result = s.datasources
	return nil
}

func (s mockDatasourceService) GetHTTPTransport(ctx context.Context, ds *models.DataSource, provider httpclient.Provider, customMiddlewares ...sdkhttpclient.Middleware) (http.RoundTripper, error) {
	return provider.GetTransport()
}
