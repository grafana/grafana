package influxdb

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryPart(t *testing.T) {
	Convey("Influxdb query parts", t, func() {

		queryContext := &tsdb.QueryContext{TimeRange: tsdb.NewTimeRange("5m", "now")}
		query := &Query{}

		Convey("render field ", func() {
			part, err := NewQueryPart("field", []string{"value"})
			So(err, ShouldBeNil)

			res := part.Render(query, queryContext, "value")
			So(res, ShouldEqual, `"value"`)
		})

		Convey("render nested part", func() {
			part, err := NewQueryPart("derivative", []string{"10s"})
			So(err, ShouldBeNil)

			res := part.Render(query, queryContext, "mean(value)")
			So(res, ShouldEqual, "derivative(mean(value), 10s)")
		})

		Convey("render bottom", func() {
			part, err := NewQueryPart("bottom", []string{"3"})
			So(err, ShouldBeNil)

			res := part.Render(query, queryContext, "value")
			So(res, ShouldEqual, "bottom(value, 3)")
		})

		Convey("render time", func() {
			part, err := NewQueryPart("time", []string{"$interval"})
			So(err, ShouldBeNil)

			res := part.Render(query, queryContext, "")
			So(res, ShouldEqual, "time(200ms)")
		})

		Convey("render time interval >10s", func() {
			part, err := NewQueryPart("time", []string{"$interval"})
			So(err, ShouldBeNil)

			query.Interval = ">10s"

			res := part.Render(query, queryContext, "")
			So(res, ShouldEqual, "time(10s)")
		})

		Convey("render time interval >1s and higher interval calculation", func() {
			part, err := NewQueryPart("time", []string{"$interval"})
			queryContext := &tsdb.QueryContext{TimeRange: tsdb.NewTimeRange("1y", "now")}
			So(err, ShouldBeNil)

			query.Interval = ">1s"

			res := part.Render(query, queryContext, "")
			So(res, ShouldEqual, "time(168h)")
		})

		Convey("render spread", func() {
			part, err := NewQueryPart("spread", []string{})
			So(err, ShouldBeNil)

			res := part.Render(query, queryContext, "value")
			So(res, ShouldEqual, `spread(value)`)
		})

		Convey("render suffix", func() {
			part, err := NewQueryPart("math", []string{"/ 100"})
			So(err, ShouldBeNil)

			res := part.Render(query, queryContext, "mean(value)")
			So(res, ShouldEqual, "mean(value) / 100")
		})

		Convey("render alias", func() {
			part, err := NewQueryPart("alias", []string{"test"})
			So(err, ShouldBeNil)

			res := part.Render(query, queryContext, "mean(value)")
			So(res, ShouldEqual, `mean(value) AS "test"`)
		})
	})
}
