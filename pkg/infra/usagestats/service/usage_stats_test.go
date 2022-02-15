package service

import (
	"bytes"
	"context"
	"errors"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// This is to ensure that the interface contract is held by the implementation
func Test_InterfaceContractValidity(t *testing.T) {
	newUsageStats := func() usagestats.Service {
		return &UsageStats{}
	}
	v, ok := newUsageStats().(*UsageStats)

	assert.NotNil(t, v)
	assert.True(t, ok)
}

func TestMetrics(t *testing.T) {
	t.Run("When sending usage stats", func(t *testing.T) {
		sqlStore := mockstore.NewSQLStoreMock()
		uss := createService(t, setting.Cfg{}, sqlStore, false)

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
		}

		setupSomeDataSourcePlugins(t, uss)

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

		uss.SQLStore = sqlStore

		createConcurrentTokens(t, uss.SQLStore)

		uss.oauthProviders = map[string]bool{
			"github":        true,
			"gitlab":        true,
			"azuread":       true,
			"google":        true,
			"generic_oauth": true,
			"grafana_com":   true,
		}

		err := uss.sendUsageStats(context.Background())
		require.NoError(t, err)

		t.Run("Given reporting not enabled and sending usage stats", func(t *testing.T) {
			origSendUsageStats := sendUsageStats
			t.Cleanup(func() {
				sendUsageStats = origSendUsageStats
			})
			statsSent := false
			sendUsageStats = func(uss *UsageStats, b *bytes.Buffer) {
				statsSent = true
			}

			uss.Cfg.ReportingEnabled = false
			err := uss.sendUsageStats(context.Background())
			require.NoError(t, err)

			require.False(t, statsSent)
		})

		t.Run("Given reporting enabled, stats should be gathered and sent to HTTP endpoint", func(t *testing.T) {
			origCfg := uss.Cfg
			t.Cleanup(func() {
				uss.Cfg = origCfg
			})
			uss.Cfg = &setting.Cfg{
				ReportingEnabled:     true,
				BuildVersion:         "5.0.0",
				AnonymousEnabled:     true,
				BasicAuthEnabled:     true,
				LDAPEnabled:          true,
				AuthProxyEnabled:     true,
				Packaging:            "deb",
				ReportingDistributor: "hosted-grafana",
			}

			ch := make(chan httpResp)
			ticker := time.NewTicker(2 * time.Second)
			ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
				buf, err := ioutil.ReadAll(r.Body)
				if err != nil {
					t.Logf("Fake HTTP handler received an error: %s", err.Error())
					ch <- httpResp{
						err: err,
					}
					return
				}
				require.NoError(t, err, "Failed to read response body, err=%v", err)
				t.Logf("Fake HTTP handler received a response")
				ch <- httpResp{
					responseBuffer: bytes.NewBuffer(buf),
					req:            r,
				}
			}))
			t.Cleanup(ts.Close)
			t.Cleanup(func() {
				close(ch)
			})
			usageStatsURL = ts.URL

			err := uss.sendUsageStats(context.Background())
			require.NoError(t, err)

			// Wait for fake HTTP server to receive a request
			var resp httpResp
			select {
			case resp = <-ch:
				require.NoError(t, resp.err, "Fake server experienced an error")
			case <-ticker.C:
				t.Fatalf("Timed out waiting for HTTP request")
			}

			t.Logf("Received response from fake HTTP server: %+v\n", resp)

			assert.NotNil(t, resp.req)

			assert.Equal(t, http.MethodPost, resp.req.Method)
			assert.Equal(t, "application/json", resp.req.Header.Get("Content-Type"))

			require.NotNil(t, resp.responseBuffer)

			j, err := simplejson.NewFromReader(resp.responseBuffer)
			require.NoError(t, err)

			assert.Equal(t, "5_0_0", j.Get("version").MustString())
			assert.Equal(t, runtime.GOOS, j.Get("os").MustString())
			assert.Equal(t, runtime.GOARCH, j.Get("arch").MustString())

			usageId := uss.GetUsageStatsId(context.Background())
			assert.NotEmpty(t, usageId)

			metrics := j.Get("metrics")
			assert.Equal(t, 15, metrics.Get("stats.total_auth_token.count").MustInt())
			assert.Equal(t, 2, metrics.Get("stats.api_keys.count").MustInt())
			assert.Equal(t, 5, metrics.Get("stats.avg_auth_token_per_user.count").MustInt())
			assert.Equal(t, 16, metrics.Get("stats.dashboard_versions.count").MustInt())
			assert.Equal(t, 17, metrics.Get("stats.annotations.count").MustInt())
			assert.Equal(t, 18, metrics.Get("stats.alert_rules.count").MustInt())
			assert.Equal(t, 19, metrics.Get("stats.library_panels.count").MustInt())
			assert.Equal(t, 20, metrics.Get("stats.library_variables.count").MustInt())
			assert.Equal(t, 0, metrics.Get("stats.live_users.count").MustInt())
			assert.Equal(t, 0, metrics.Get("stats.live_clients.count").MustInt())

			assert.Equal(t, 9, metrics.Get("stats.ds."+models.DS_ES+".count").MustInt())
			assert.Equal(t, 10, metrics.Get("stats.ds."+models.DS_PROMETHEUS+".count").MustInt())

			assert.Equal(t, 11+12, metrics.Get("stats.ds.other.count").MustInt())

			assert.Equal(t, 1, metrics.Get("stats.ds_access."+models.DS_ES+".direct.count").MustInt())
			assert.Equal(t, 2, metrics.Get("stats.ds_access."+models.DS_ES+".proxy.count").MustInt())
			assert.Equal(t, 3, metrics.Get("stats.ds_access."+models.DS_PROMETHEUS+".proxy.count").MustInt())
			assert.Equal(t, 6+7, metrics.Get("stats.ds_access.other.direct.count").MustInt())
			assert.Equal(t, 4+8, metrics.Get("stats.ds_access.other.proxy.count").MustInt())

			assert.Equal(t, 1, metrics.Get("stats.alert_notifiers.slack.count").MustInt())
			assert.Equal(t, 2, metrics.Get("stats.alert_notifiers.webhook.count").MustInt())

			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.anonymous.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.basic_auth.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.ldap.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.auth_proxy.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.oauth_github.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.oauth_gitlab.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.oauth_google.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.oauth_azuread.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.oauth_generic_oauth.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.auth_enabled.oauth_grafana_com.count").MustInt())

			assert.Equal(t, 1, metrics.Get("stats.packaging.deb.count").MustInt())
			assert.Equal(t, 1, metrics.Get("stats.distributor.hosted-grafana.count").MustInt())

			assert.LessOrEqual(t, 60, metrics.Get("stats.uptime").MustInt())
			assert.Greater(t, 70, metrics.Get("stats.uptime").MustInt())
		})
	})

	t.Run("When updating total stats", func(t *testing.T) {
		sqlStore := mockstore.NewSQLStoreMock()
		uss := createService(t, setting.Cfg{}, sqlStore, false)
		uss.Cfg.MetricsEndpointEnabled = true
		uss.Cfg.MetricsEndpointDisableTotalStats = false

		sqlStore.ExpectedSystemStats = &models.SystemStats{}

		t.Run("When metrics is disabled and total stats is enabled, stats should not be updated", func(t *testing.T) {
			uss.Cfg.MetricsEndpointEnabled = false
			uss.Cfg.MetricsEndpointDisableTotalStats = false
			uss.updateTotalStats(context.Background())
		})

		t.Run("When metrics is enabled and total stats is disabled, stats should not be updated", func(t *testing.T) {
			uss.Cfg.MetricsEndpointEnabled = true
			uss.Cfg.MetricsEndpointDisableTotalStats = true

			uss.updateTotalStats(context.Background())
		})

		t.Run("When metrics is disabled and total stats is disabled, stats should not be updated", func(t *testing.T) {
			uss.Cfg.MetricsEndpointEnabled = false
			uss.Cfg.MetricsEndpointDisableTotalStats = true

			uss.updateTotalStats(context.Background())
		})

		t.Run("When metrics is enabled and total stats is enabled, stats should be updated", func(t *testing.T) {
			uss.Cfg.MetricsEndpointEnabled = true
			uss.Cfg.MetricsEndpointDisableTotalStats = false

			uss.updateTotalStats(context.Background())
		})
	})

	t.Run("When registering a metric", func(t *testing.T) {
		sqlStore := mockstore.NewSQLStoreMock()
		uss := createService(t, setting.Cfg{}, sqlStore, false)
		metricName := "stats.test_metric.count"

		t.Run("Adds a new metric to the external metrics", func(t *testing.T) {
			uss.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
				return map[string]interface{}{metricName: 1}, nil
			})

			metrics, err := uss.externalMetrics[0](context.Background())
			require.NoError(t, err)
			assert.Equal(t, map[string]interface{}{metricName: 1}, metrics)
		})
	})

	t.Run("When getting usage report", func(t *testing.T) {
		sqlStore := mockstore.NewSQLStoreMock()
		uss := createService(t, setting.Cfg{}, sqlStore, true)
		metricName := "stats.test_metric.count"

		createConcurrentTokens(t, uss.SQLStore)

		t.Run("Should include metrics for concurrent users", func(t *testing.T) {
			report, err := uss.GetUsageReport(context.Background())
			require.NoError(t, err)

			assert.Equal(t, int32(1), report.Metrics["stats.auth_token_per_user_le_3"])
			assert.Equal(t, int32(2), report.Metrics["stats.auth_token_per_user_le_6"])
			assert.Equal(t, int32(3), report.Metrics["stats.auth_token_per_user_le_9"])
			assert.Equal(t, int32(4), report.Metrics["stats.auth_token_per_user_le_12"])
			assert.Equal(t, int32(5), report.Metrics["stats.auth_token_per_user_le_15"])
			assert.Equal(t, int32(6), report.Metrics["stats.auth_token_per_user_le_inf"])
		})

		t.Run("Should include external metrics", func(t *testing.T) {
			uss.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
				return map[string]interface{}{metricName: 1}, nil
			})

			report, err := uss.GetUsageReport(context.Background())
			require.NoError(t, err, "Expected no error")

			metric := report.Metrics[metricName]
			assert.Equal(t, 1, metric)
		})
	})

	t.Run("When registering external metrics", func(t *testing.T) {
		sqlStore := mockstore.NewSQLStoreMock()
		uss := createService(t, setting.Cfg{}, sqlStore, false)
		metrics := map[string]interface{}{"stats.test_metric.count": 1, "stats.test_metric_second.count": 2}
		extMetricName := "stats.test_external_metric.count"

		uss.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
			return map[string]interface{}{extMetricName: 1}, nil
		})

		uss.registerExternalMetrics(context.Background(), metrics)

		assert.Equal(t, 1, metrics[extMetricName])

		t.Run("When loading a metric results to an error", func(t *testing.T) {
			uss.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
				return map[string]interface{}{extMetricName: 1}, nil
			})
			extErrorMetricName := "stats.test_external_metric_error.count"

			t.Run("Should not add it to metrics", func(t *testing.T) {
				uss.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
					return map[string]interface{}{extErrorMetricName: 1}, errors.New("some error")
				})

				uss.registerExternalMetrics(context.Background(), metrics)

				extErrorMetric := metrics[extErrorMetricName]
				extMetric := metrics[extMetricName]

				require.Nil(t, extErrorMetric, "Invalid metric should not be added")
				assert.Equal(t, 1, extMetric)
				assert.Len(t, metrics, 3, "Expected only one available metric")
			})
		})
	})
}

type fakePluginStore struct {
	plugins.Store

	plugins map[string]plugins.PluginDTO
}

func (pr fakePluginStore) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := pr.plugins[pluginID]

	return p, exists
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

func setupSomeDataSourcePlugins(t *testing.T, uss *UsageStats) {
	t.Helper()

	uss.pluginStore = &fakePluginStore{
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

type httpResp struct {
	req            *http.Request
	responseBuffer *bytes.Buffer
	err            error
}

func createService(t *testing.T, cfg setting.Cfg, sqlStore sqlstore.Store, withDB bool) *UsageStats {
	t.Helper()
	if withDB {
		sqlStore = sqlstore.InitTestDB(t)
	}
	return &UsageStats{
		Cfg:             &cfg,
		SQLStore:        sqlStore,
		externalMetrics: make([]usagestats.MetricsFunc, 0),
		pluginStore:     &fakePluginStore{},
		kvStore:         kvstore.WithNamespace(kvstore.ProvideService(sqlStore), 0, "infra.usagestats"),
		log:             log.New("infra.usagestats"),
		startTime:       time.Now().Add(-1 * time.Minute),
		RouteRegister:   routing.NewRouteRegister(),
	}
}
