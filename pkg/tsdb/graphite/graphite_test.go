package graphite

import (
	. "github.com/smartystreets/goconvey/convey"
	"testing"
)

func TestGraphiteFunctions(t *testing.T) {
	Convey("Testing Graphite Functions", t, func() {

		Convey("formatting time range for now", func() {

			timeRange := formatTimeRange("now")
			So(timeRange, ShouldEqual, "now")

		})

		Convey("formatting time range for now-1m", func() {

			timeRange := formatTimeRange("now-1m")
			So(timeRange, ShouldEqual, "-1min")

		})

		Convey("formatting time range for now-1M", func() {

			timeRange := formatTimeRange("now-1M")
			So(timeRange, ShouldEqual, "-1mon")

		})

		Convey("fix interval format in query for 1m", func() {

			timeRange := fixIntervalFormat("aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1m'), 4)")
			So(timeRange, ShouldEqual, "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1min'), 4)")

		})

		Convey("fix interval format in query for 1M", func() {

			timeRange := fixIntervalFormat("aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1M'), 4)")
			So(timeRange, ShouldEqual, "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1mon'), 4)")

		})

		Convey("should not override query for 1M", func() {

			timeRange := fixIntervalFormat("app.grafana.*.dashboards.views.1M.count")
			So(timeRange, ShouldEqual, "app.grafana.*.dashboards.views.1M.count")

		})

		Convey("should not override query for 1m", func() {

			timeRange := fixIntervalFormat("app.grafana.*.dashboards.views.1m.count")
			So(timeRange, ShouldEqual, "app.grafana.*.dashboards.views.1m.count")

		})

	})
}
