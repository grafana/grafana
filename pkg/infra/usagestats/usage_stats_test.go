package usagestats

import (
	"bytes"
	"io/ioutil"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/licensing"

	"net/http"
	"net/http/httptest"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMetrics(t *testing.T) {
	Convey("Test send usage stats", t, func() {
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

		oauthProviders := map[string]bool{
			"github":        true,
			"gitlab":        true,
			"azuread":       true,
			"google":        true,
			"generic_oauth": true,
			"grafana_com":   true,
		}

		uss.sendUsageStats(oauthProviders)

		Convey("Given reporting not enabled and sending usage stats", func() {
			setting.ReportingEnabled = false
			uss.sendUsageStats(oauthProviders)

			Convey("Should not gather stats or call http endpoint", func() {
				So(getSystemStatsQuery, ShouldBeNil)
				So(getDataSourceStatsQuery, ShouldBeNil)
				So(getDataSourceAccessStatsQuery, ShouldBeNil)
				So(req, ShouldBeNil)
			})
		})

		Convey("Given reporting enabled and sending usage stats", func() {
			setting.ReportingEnabled = true
			setting.BuildVersion = "5.0.0"
			setting.AnonymousEnabled = true
			setting.BasicAuthEnabled = true
			setting.LDAPEnabled = true
			setting.AuthProxyEnabled = true
			setting.Packaging = "deb"

			wg.Add(1)
			uss.sendUsageStats(oauthProviders)

			Convey("Should gather stats and call http endpoint", func() {
				if waitTimeout(&wg, 2*time.Second) {
					t.Fatalf("Timed out waiting for http request")
				}

				So(getSystemStatsQuery, ShouldNotBeNil)
				So(getDataSourceStatsQuery, ShouldNotBeNil)
				So(getDataSourceAccessStatsQuery, ShouldNotBeNil)
				So(getAlertNotifierUsageStatsQuery, ShouldNotBeNil)
				So(req, ShouldNotBeNil)
				So(req.Method, ShouldEqual, http.MethodPost)
				So(req.Header.Get("Content-Type"), ShouldEqual, "application/json")

				So(responseBuffer, ShouldNotBeNil)

				j, err := simplejson.NewFromReader(responseBuffer)
				So(err, ShouldBeNil)

				So(j.Get("version").MustString(), ShouldEqual, "5_0_0")
				So(j.Get("os").MustString(), ShouldEqual, runtime.GOOS)
				So(j.Get("arch").MustString(), ShouldEqual, runtime.GOARCH)

				metrics := j.Get("metrics")
				So(metrics.Get("stats.dashboards.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Dashboards)
				So(metrics.Get("stats.users.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Users)
				So(metrics.Get("stats.orgs.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Orgs)
				So(metrics.Get("stats.playlist.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Playlists)
				So(metrics.Get("stats.plugins.apps.count").MustInt(), ShouldEqual, len(plugins.Apps))
				So(metrics.Get("stats.plugins.panels.count").MustInt(), ShouldEqual, len(plugins.Panels))
				So(metrics.Get("stats.plugins.datasources.count").MustInt(), ShouldEqual, len(plugins.DataSources))
				So(metrics.Get("stats.alerts.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Alerts)
				So(metrics.Get("stats.active_users.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.ActiveUsers)
				So(metrics.Get("stats.datasources.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Datasources)
				So(metrics.Get("stats.stars.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Stars)
				So(metrics.Get("stats.folders.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Folders)
				So(metrics.Get("stats.dashboard_permissions.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.DashboardPermissions)
				So(metrics.Get("stats.folder_permissions.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.FolderPermissions)
				So(metrics.Get("stats.provisioned_dashboards.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.ProvisionedDashboards)
				So(metrics.Get("stats.snapshots.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Snapshots)
				So(metrics.Get("stats.teams.count").MustInt(), ShouldEqual, getSystemStatsQuery.Result.Teams)
				So(metrics.Get("stats.total_auth_token.count").MustInt64(), ShouldEqual, 15)
				So(metrics.Get("stats.avg_auth_token_per_user.count").MustInt64(), ShouldEqual, 5)
				So(metrics.Get("stats.dashboard_versions.count").MustInt64(), ShouldEqual, 16)
				So(metrics.Get("stats.annotations.count").MustInt64(), ShouldEqual, 17)

				So(metrics.Get("stats.ds."+models.DS_ES+".count").MustInt(), ShouldEqual, 9)
				So(metrics.Get("stats.ds."+models.DS_PROMETHEUS+".count").MustInt(), ShouldEqual, 10)
				So(metrics.Get("stats.ds.other.count").MustInt(), ShouldEqual, 11+12)

				So(metrics.Get("stats.ds_access."+models.DS_ES+".direct.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.ds_access."+models.DS_ES+".proxy.count").MustInt(), ShouldEqual, 2)
				So(metrics.Get("stats.ds_access."+models.DS_PROMETHEUS+".proxy.count").MustInt(), ShouldEqual, 3)
				So(metrics.Get("stats.ds_access.other.direct.count").MustInt(), ShouldEqual, 6+7)
				So(metrics.Get("stats.ds_access.other.proxy.count").MustInt(), ShouldEqual, 4+8)

				So(metrics.Get("stats.alerting.ds.prometheus.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.alerting.ds.graphite.count").MustInt(), ShouldEqual, 2)
				So(metrics.Get("stats.alerting.ds.mysql.count").MustInt(), ShouldEqual, 5)
				So(metrics.Get("stats.alerting.ds.other.count").MustInt(), ShouldEqual, 90)

				So(metrics.Get("stats.alert_notifiers.slack.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.alert_notifiers.webhook.count").MustInt(), ShouldEqual, 2)

				So(metrics.Get("stats.auth_enabled.anonymous.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.basic_auth.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.ldap.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.auth_proxy.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.oauth_github.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.oauth_gitlab.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.oauth_google.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.oauth_azuread.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.oauth_generic_oauth.count").MustInt(), ShouldEqual, 1)
				So(metrics.Get("stats.auth_enabled.oauth_grafana_com.count").MustInt(), ShouldEqual, 1)

				So(metrics.Get("stats.packaging.deb.count").MustInt(), ShouldEqual, 1)

			})
		})

		Reset(func() {
			ts.Close()
		})
	})

	Convey("Test update total stats", t, func() {
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

		Convey("should not update stats when metrics is disabled and total stats is disabled", func() {
			uss.Cfg.MetricsEndpointEnabled = false
			uss.Cfg.MetricsEndpointDisableTotalStats = true
			uss.updateTotalStats()
			So(getSystemStatsWasCalled, ShouldBeFalse)
		})

		Convey("should not update stats when metrics is disabled and total stats enabled", func() {
			uss.Cfg.MetricsEndpointEnabled = false
			uss.Cfg.MetricsEndpointDisableTotalStats = false
			uss.updateTotalStats()
			So(getSystemStatsWasCalled, ShouldBeFalse)
		})

		Convey("should not update stats when metrics is enabled and total stats disabled", func() {
			uss.Cfg.MetricsEndpointEnabled = true
			uss.Cfg.MetricsEndpointDisableTotalStats = true
			uss.updateTotalStats()
			So(getSystemStatsWasCalled, ShouldBeFalse)
		})

		Convey("should update stats when metrics is enabled and total stats enabled", func() {
			uss.Cfg.MetricsEndpointEnabled = true
			uss.Cfg.MetricsEndpointDisableTotalStats = false
			uss.updateTotalStats()
			So(getSystemStatsWasCalled, ShouldBeTrue)
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
