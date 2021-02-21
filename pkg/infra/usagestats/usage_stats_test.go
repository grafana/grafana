package usagestats

import (
	"bytes"
	"context"
	"errors"
	"io/ioutil"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/stretchr/testify/require"

	"net/http"
	"net/http/httptest"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

// This is to ensure that the interface contract is held by the implementation
func Test_InterfaceContractValidity(t *testing.T) {
	newUsageStats := func() UsageStats {
		return &UsageStatsService{}
	}
	v, ok := newUsageStats().(*UsageStatsService)

	assert.NotNil(t, v)
	assert.True(t, ok)
}

func TestMetrics(t *testing.T) {
	t.Run("When sending usage stats", func(t *testing.T) {
		uss := &UsageStatsService{
			Bus:      bus.New(),
			SQLStore: sqlstore.InitTestDB(t),
			License:  &licensing.OSSLicensingService{},
		}

		var getSystemStatsQuery *models.GetSystemStatsQuery
		uss.Bus.AddHandler(func(query *models.GetSystemStatsQuery) error {
			query.Result = &models.SystemStats{
				Dashboards:            1,
				Datasources:           2,
				Users:                 3,
				ActiveUsers:           4,
				Orgs:                  5,
				Playlists:             6,
				Alerts:                7,
				Stars:                 8,
				Folders:               9,
				DashboardPermissions:  10,
				FolderPermissions:     11,
				ProvisionedDashboards: 12,
				Snapshots:             13,
				Teams:                 14,
				AuthTokens:            15,
				DashboardVersions:     16,
				Annotations:           17,
			}
			getSystemStatsQuery = query
			return nil
		})

		var getDataSourceStatsQuery *models.GetDataSourceStatsQuery
		uss.Bus.AddHandler(func(query *models.GetDataSourceStatsQuery) error {
			query.Result = []*models.DataSourceStats{
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
			getDataSourceStatsQuery = query
			return nil
		})

		var getDataSourceAccessStatsQuery *models.GetDataSourceAccessStatsQuery
		uss.Bus.AddHandler(func(query *models.GetDataSourceAccessStatsQuery) error {
			query.Result = []*models.DataSourceAccessStats{
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
			getDataSourceAccessStatsQuery = query
			return nil
		})

		var getAlertNotifierUsageStatsQuery *models.GetAlertNotifierUsageStatsQuery
		uss.Bus.AddHandler(func(query *models.GetAlertNotifierUsageStatsQuery) error {
			query.Result = []*models.NotifierUsageStats{
				{
					Type:  "slack",
					Count: 1,
				},
				{
					Type:  "webhook",
					Count: 2,
				},
			}

			getAlertNotifierUsageStatsQuery = query

			return nil
		})

		createConcurrentTokens(t, uss.SQLStore)
		uss.AlertingUsageStats = &alertingUsageMock{}

		var wg sync.WaitGroup
		var responseBuffer *bytes.Buffer
		var req *http.Request
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			req = r
			buf, err := ioutil.ReadAll(r.Body)
			if err != nil {
				t.Fatalf("Failed to read response body, err=%v", err)
			}
			responseBuffer = bytes.NewBuffer(buf)
			wg.Done()
		}))
		usageStatsURL = ts.URL

		defer ts.Close()

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
			setting.ReportingEnabled = false
			err := uss.sendUsageStats(context.Background())
			require.NoError(t, err)

			t.Run("Should not gather stats or call http endpoint", func(t *testing.T) {
				assert.Nil(t, getSystemStatsQuery)
				assert.Nil(t, getDataSourceStatsQuery)
				assert.Nil(t, getDataSourceAccessStatsQuery)
				assert.Nil(t, req)
			})
		})

		t.Run("Given reporting enabled and sending usage stats", func(t *testing.T) {
			setting.ReportingEnabled = true
			setting.BuildVersion = "5.0.0"
			setting.AnonymousEnabled = true
			setting.BasicAuthEnabled = true
			setting.LDAPEnabled = true
			setting.AuthProxyEnabled = true
			setting.Packaging = "deb"
			setting.ReportingDistributor = "hosted-grafana"

			wg.Add(1)
			err := uss.sendUsageStats(context.Background())
			require.NoError(t, err)

			t.Run("Should gather stats and call http endpoint", func(t *testing.T) {
				if waitTimeout(&wg, 2*time.Second) {
					t.Fatalf("Timed out waiting for http request")
				}

				assert.NotNil(t, getSystemStatsQuery)
				assert.NotNil(t, getDataSourceStatsQuery)
				assert.NotNil(t, getDataSourceAccessStatsQuery)
				assert.NotNil(t, getAlertNotifierUsageStatsQuery)
				assert.NotNil(t, req)

				assert.Equal(t, http.MethodPost, req.Method)
				assert.Equal(t, "application/json", req.Header.Get("Content-Type"))

				assert.NotNil(t, responseBuffer)

				j, err := simplejson.NewFromReader(responseBuffer)
				assert.Nil(t, err)

				assert.Equal(t, "5_0_0", j.Get("version").MustString())
				assert.Equal(t, runtime.GOOS, j.Get("os").MustString())
				assert.Equal(t, runtime.GOARCH, j.Get("arch").MustString())

				metrics := j.Get("metrics")
				assert.Equal(t, getSystemStatsQuery.Result.Dashboards, metrics.Get("stats.dashboards.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.Users, metrics.Get("stats.users.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.Orgs, metrics.Get("stats.orgs.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.Playlists, metrics.Get("stats.playlist.count").MustInt64())
				assert.Equal(t, len(plugins.Apps), metrics.Get("stats.plugins.apps.count").MustInt())
				assert.Equal(t, len(plugins.Panels), metrics.Get("stats.plugins.panels.count").MustInt())
				assert.Equal(t, len(plugins.DataSources), metrics.Get("stats.plugins.datasources.count").MustInt())
				assert.Equal(t, getSystemStatsQuery.Result.Alerts, metrics.Get("stats.alerts.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.ActiveUsers, metrics.Get("stats.active_users.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.Datasources, metrics.Get("stats.datasources.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.Stars, metrics.Get("stats.stars.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.Folders, metrics.Get("stats.folders.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.DashboardPermissions, metrics.Get("stats.dashboard_permissions.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.FolderPermissions, metrics.Get("stats.folder_permissions.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.ProvisionedDashboards, metrics.Get("stats.provisioned_dashboards.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.Snapshots, metrics.Get("stats.snapshots.count").MustInt64())
				assert.Equal(t, getSystemStatsQuery.Result.Teams, metrics.Get("stats.teams.count").MustInt64())
				assert.Equal(t, 15, metrics.Get("stats.total_auth_token.count").MustInt())
				assert.Equal(t, 5, metrics.Get("stats.avg_auth_token_per_user.count").MustInt())
				assert.Equal(t, 16, metrics.Get("stats.dashboard_versions.count").MustInt())
				assert.Equal(t, 17, metrics.Get("stats.annotations.count").MustInt())

				assert.Equal(t, 9, metrics.Get("stats.ds."+models.DS_ES+".count").MustInt())
				assert.Equal(t, 10, metrics.Get("stats.ds."+models.DS_PROMETHEUS+".count").MustInt())
				assert.Equal(t, 11+12, metrics.Get("stats.ds.other.count").MustInt())

				assert.Equal(t, 1, metrics.Get("stats.ds_access."+models.DS_ES+".direct.count").MustInt())
				assert.Equal(t, 2, metrics.Get("stats.ds_access."+models.DS_ES+".proxy.count").MustInt())
				assert.Equal(t, 3, metrics.Get("stats.ds_access."+models.DS_PROMETHEUS+".proxy.count").MustInt())
				assert.Equal(t, 6+7, metrics.Get("stats.ds_access.other.direct.count").MustInt())
				assert.Equal(t, 4+8, metrics.Get("stats.ds_access.other.proxy.count").MustInt())

				assert.Equal(t, 1, metrics.Get("stats.alerting.ds.prometheus.count").MustInt())
				assert.Equal(t, 2, metrics.Get("stats.alerting.ds.graphite.count").MustInt())
				assert.Equal(t, 5, metrics.Get("stats.alerting.ds.mysql.count").MustInt())
				assert.Equal(t, 90, metrics.Get("stats.alerting.ds.other.count").MustInt())

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

				assert.Equal(t, 1, metrics.Get("stats.auth_token_per_user_le_3").MustInt())
				assert.Equal(t, 2, metrics.Get("stats.auth_token_per_user_le_6").MustInt())
				assert.Equal(t, 3, metrics.Get("stats.auth_token_per_user_le_9").MustInt())
				assert.Equal(t, 4, metrics.Get("stats.auth_token_per_user_le_12").MustInt())
				assert.Equal(t, 5, metrics.Get("stats.auth_token_per_user_le_15").MustInt())
				assert.Equal(t, 6, metrics.Get("stats.auth_token_per_user_le_inf").MustInt())
			})
		})
	})

	t.Run("When updating total stats", func(t *testing.T) {
		uss := &UsageStatsService{
			Bus: bus.New(),
			Cfg: setting.NewCfg(),
		}
		uss.Cfg.MetricsEndpointEnabled = true
		uss.Cfg.MetricsEndpointDisableTotalStats = false
		getSystemStatsWasCalled := false
		uss.Bus.AddHandler(func(query *models.GetSystemStatsQuery) error {
			query.Result = &models.SystemStats{}
			getSystemStatsWasCalled = true
			return nil
		})

		t.Run("When metrics is disabled and total stats is enabled", func(t *testing.T) {
			uss.Cfg.MetricsEndpointEnabled = false
			uss.Cfg.MetricsEndpointDisableTotalStats = false
			t.Run("Should not update stats", func(t *testing.T) {
				uss.updateTotalStats()

				assert.False(t, getSystemStatsWasCalled)
			})
		})

		t.Run("When metrics is enabled and total stats is disabled", func(t *testing.T) {
			uss.Cfg.MetricsEndpointEnabled = true
			uss.Cfg.MetricsEndpointDisableTotalStats = true

			t.Run("Should not update stats", func(t *testing.T) {
				uss.updateTotalStats()

				assert.False(t, getSystemStatsWasCalled)
			})
		})

		t.Run("When metrics is disabled and total stats is disabled", func(t *testing.T) {
			uss.Cfg.MetricsEndpointEnabled = false
			uss.Cfg.MetricsEndpointDisableTotalStats = true

			t.Run("Should not update stats", func(t *testing.T) {
				uss.updateTotalStats()

				assert.False(t, getSystemStatsWasCalled)
			})
		})

		t.Run("When metrics is enabled and total stats is enabled", func(t *testing.T) {
			uss.Cfg.MetricsEndpointEnabled = true
			uss.Cfg.MetricsEndpointDisableTotalStats = false

			t.Run("Should update stats", func(t *testing.T) {
				uss.updateTotalStats()

				assert.True(t, getSystemStatsWasCalled)
			})
		})
	})

	t.Run("When registering a metric", func(t *testing.T) {
		uss := &UsageStatsService{
			Bus:             bus.New(),
			Cfg:             setting.NewCfg(),
			externalMetrics: make(map[string]MetricFunc),
		}
		metricName := "stats.test_metric.count"

		t.Run("Adds a new metric to the external metrics", func(t *testing.T) {
			uss.RegisterMetric(metricName, func() (interface{}, error) {
				return 1, nil
			})

			metric, _ := uss.externalMetrics[metricName]()
			assert.Equal(t, 1, metric)
		})

		t.Run("When metric already exists", func(t *testing.T) {
			uss.RegisterMetric(metricName, func() (interface{}, error) {
				return 1, nil
			})

			metric, _ := uss.externalMetrics[metricName]()
			assert.Equal(t, 1, metric)

			t.Run("Overrides the metric", func(t *testing.T) {
				uss.RegisterMetric(metricName, func() (interface{}, error) {
					return 2, nil
				})
				newMetric, _ := uss.externalMetrics[metricName]()
				assert.Equal(t, 2, newMetric)
			})
		})
	})

	t.Run("When getting usage report", func(t *testing.T) {
		uss := &UsageStatsService{
			Bus:                bus.New(),
			Cfg:                setting.NewCfg(),
			SQLStore:           sqlstore.InitTestDB(t),
			License:            &licensing.OSSLicensingService{},
			AlertingUsageStats: &alertingUsageMock{},
			externalMetrics:    make(map[string]MetricFunc),
		}
		metricName := "stats.test_metric.count"

		uss.Bus.AddHandler(func(query *models.GetSystemStatsQuery) error {
			query.Result = &models.SystemStats{}
			return nil
		})

		uss.Bus.AddHandler(func(query *models.GetDataSourceStatsQuery) error {
			query.Result = []*models.DataSourceStats{}
			return nil
		})

		uss.Bus.AddHandler(func(query *models.GetDataSourceAccessStatsQuery) error {
			query.Result = []*models.DataSourceAccessStats{}
			return nil
		})

		uss.Bus.AddHandler(func(query *models.GetAlertNotifierUsageStatsQuery) error {
			query.Result = []*models.NotifierUsageStats{}
			return nil
		})

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
			uss.RegisterMetric(metricName, func() (interface{}, error) {
				return 1, nil
			})

			report, err := uss.GetUsageReport(context.Background())
			assert.Nil(t, err, "Expected no error")

			metric := report.Metrics[metricName]
			assert.Equal(t, 1, metric)
		})
	})

	t.Run("When registering external metrics", func(t *testing.T) {
		uss := &UsageStatsService{
			Bus:             bus.New(),
			Cfg:             setting.NewCfg(),
			externalMetrics: make(map[string]MetricFunc),
		}
		metrics := map[string]interface{}{"stats.test_metric.count": 1, "stats.test_metric_second.count": 2}
		extMetricName := "stats.test_external_metric.count"

		t.Run("Should add to metrics", func(t *testing.T) {
			uss.RegisterMetric(extMetricName, func() (interface{}, error) {
				return 1, nil
			})

			uss.registerExternalMetrics(metrics)

			assert.Equal(t, 1, metrics[extMetricName])
		})

		t.Run("When loading a metric results to an error", func(t *testing.T) {
			uss.RegisterMetric(extMetricName, func() (interface{}, error) {
				return 1, nil
			})
			extErrorMetricName := "stats.test_external_metric_error.count"

			t.Run("Should not add it to metrics", func(t *testing.T) {
				uss.RegisterMetric(extErrorMetricName, func() (interface{}, error) {
					return 1, errors.New("some error")
				})

				uss.registerExternalMetrics(metrics)

				extErrorMetric := metrics[extErrorMetricName]
				extMetric := metrics[extMetricName]

				assert.Nil(t, extErrorMetric, "Invalid metric should not be added")
				assert.Equal(t, 1, extMetric)
				assert.Len(t, metrics, 3, "Expected only one available metric")
			})
		})
	})
}

func waitTimeout(wg *sync.WaitGroup, timeout time.Duration) bool {
	c := make(chan struct{})
	go func() {
		defer close(c)
		wg.Wait()
	}()
	select {
	case <-c:
		return false // completed normally
	case <-time.After(timeout):
		return true // timed out
	}
}

type alertingUsageMock struct{}

func (aum *alertingUsageMock) QueryUsageStats() (*alerting.UsageStats, error) {
	return &alerting.UsageStats{
		DatasourceUsage: map[string]int{
			"prometheus":         1,
			"graphite":           2,
			"mysql":              5,
			"unknown-datasource": 90,
		},
	}, nil
}
