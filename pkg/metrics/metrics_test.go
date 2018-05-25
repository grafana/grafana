package metrics

import (
	"bytes"
	"io/ioutil"
	"runtime"
	"sync"
	"testing"
	"time"

	"net/http"
	"net/http/httptest"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMetrics(t *testing.T) {
	Convey("Test send usage stats", t, func() {
		var getSystemStatsQuery *models.GetSystemStatsQuery
		bus.AddHandler("test", func(query *models.GetSystemStatsQuery) error {
			query.Result = &models.SystemStats{
				Dashboards:  1,
				Datasources: 2,
				Users:       3,
				ActiveUsers: 4,
				Orgs:        5,
				Playlists:   6,
				Alerts:      7,
				Stars:       8,
			}
			getSystemStatsQuery = query
			return nil
		})

		var getDataSourceStatsQuery *models.GetDataSourceStatsQuery
		bus.AddHandler("test", func(query *models.GetDataSourceStatsQuery) error {
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

		sendUsageStats()

		Convey("Given reporting not enabled and sending usage stats", func() {
			setting.ReportingEnabled = false
			sendUsageStats()

			Convey("Should not gather stats or call http endpoint", func() {
				So(getSystemStatsQuery, ShouldBeNil)
				So(getDataSourceStatsQuery, ShouldBeNil)
				So(req, ShouldBeNil)
			})
		})

		Convey("Given reporting enabled and sending usage stats", func() {
			setting.ReportingEnabled = true
			setting.BuildVersion = "5.0.0"
			wg.Add(1)
			sendUsageStats()

			Convey("Should gather stats and call http endpoint", func() {
				if waitTimeout(&wg, 2*time.Second) {
					t.Fatalf("Timed out waiting for http request")
				}

				So(getSystemStatsQuery, ShouldNotBeNil)
				So(getDataSourceStatsQuery, ShouldNotBeNil)
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

				So(metrics.Get("stats.ds."+models.DS_ES+".count").MustInt(), ShouldEqual, 9)
				So(metrics.Get("stats.ds."+models.DS_PROMETHEUS+".count").MustInt(), ShouldEqual, 10)
				So(metrics.Get("stats.ds.other.count").MustInt(), ShouldEqual, 11+12)
			})
		})

		Reset(func() {
			ts.Close()
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
