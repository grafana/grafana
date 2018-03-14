package postgres

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {
		engine := &PostgresMacroEngine{}
		query := &tsdb.Query{}
		timeRange := &tsdb.TimeRange{From: "5m", To: "now"}

		Convey("interpolate __time function", func() {
			sql, err := engine.Interpolate(query, timeRange, "select $__time(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select time_column AS \"time\"")
		})

		Convey("interpolate __time function wrapped in aggregation", func() {
			sql, err := engine.Interpolate(query, timeRange, "select min($__time(time_column))")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select min(time_column AS \"time\")")
		})

		Convey("interpolate __timeFilter function", func() {
			sql, err := engine.Interpolate(query, timeRange, "WHERE $__timeFilter(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "WHERE extract(epoch from time_column) BETWEEN 18446744066914186738 AND 18446744066914187038")
		})

		Convey("interpolate __timeFrom function", func() {
			sql, err := engine.Interpolate(query, timeRange, "select $__timeFrom(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select to_timestamp(18446744066914186738)")
		})

		Convey("interpolate __timeGroup function", func() {

			sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column,'5m')")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "GROUP BY (extract(epoch from time_column)/300)::bigint*300 AS time")
		})

		Convey("interpolate __timeGroup function with spaces between args", func() {

			sql, err := engine.Interpolate(query, timeRange, "GROUP BY $__timeGroup(time_column , '5m')")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "GROUP BY (extract(epoch from time_column)/300)::bigint*300 AS time")
		})

		Convey("interpolate __timeTo function", func() {
			sql, err := engine.Interpolate(query, timeRange, "select $__timeTo(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select to_timestamp(18446744066914187038)")
		})

		Convey("interpolate __unixEpochFilter function", func() {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFilter(18446744066914186738)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914186738 >= 18446744066914186738 AND 18446744066914186738 <= 18446744066914187038")
		})

		Convey("interpolate __unixEpochFrom function", func() {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochFrom()")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914186738")
		})

		Convey("interpolate __unixEpochTo function", func() {
			sql, err := engine.Interpolate(query, timeRange, "select $__unixEpochTo()")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914187038")
		})

	})
}
