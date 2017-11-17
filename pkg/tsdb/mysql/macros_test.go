package mysql

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {
		engine := &MySqlMacroEngine{}
		timeRange := &tsdb.TimeRange{From: "5m", To: "now"}

		Convey("interpolate __time function", func() {
			sql, err := engine.Interpolate(nil, "select $__time(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select UNIX_TIMESTAMP(time_column) as time_sec")
		})

		Convey("interpolate __time function wrapped in aggregation", func() {
			sql, err := engine.Interpolate(nil, "select min($__time(time_column))")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select min(UNIX_TIMESTAMP(time_column) as time_sec)")
		})

		Convey("interpolate __timeFilter function", func() {
			sql, err := engine.Interpolate(timeRange, "WHERE $__timeFilter(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "WHERE time_column >= FROM_UNIXTIME(18446744066914186738) AND time_column <= FROM_UNIXTIME(18446744066914187038)")
		})

		Convey("interpolate __timeFrom function", func() {
			sql, err := engine.Interpolate(timeRange, "select $__timeFrom(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select FROM_UNIXTIME(18446744066914186738)")
		})

		Convey("interpolate __timeGroup function", func() {

			sql, err := engine.Interpolate(timeRange, "GROUP BY $__timeGroup(time_column,'5m')")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "GROUP BY cast(cast(UNIX_TIMESTAMP(time_column)/(300) as signed)*300 as signed)")
		})

		Convey("interpolate __timeTo function", func() {
			sql, err := engine.Interpolate(timeRange, "select $__timeTo(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select FROM_UNIXTIME(18446744066914187038)")
		})

		Convey("interpolate __unixEpochFilter function", func() {
			sql, err := engine.Interpolate(timeRange, "select $__unixEpochFilter(18446744066914186738)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914186738 >= 18446744066914186738 AND 18446744066914186738 <= 18446744066914187038")
		})

		Convey("interpolate __unixEpochFrom function", func() {
			sql, err := engine.Interpolate(timeRange, "select $__unixEpochFrom()")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914186738")
		})

		Convey("interpolate __unixEpochTo function", func() {
			sql, err := engine.Interpolate(timeRange, "select $__unixEpochTo()")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914187038")
		})

	})
}
