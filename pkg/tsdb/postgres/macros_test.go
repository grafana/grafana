package postgres

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	SkipConvey("MacroEngine", t, func() {

		Convey("interpolate __time function", func() {
			engine := &PostgresMacroEngine{}

			sql, err := engine.Interpolate("select $__time(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select UNIX_TIMESTAMP(time_column) as time_sec")
		})

		Convey("interpolate __time function wrapped in aggregation", func() {
			engine := &PostgresMacroEngine{}

			sql, err := engine.Interpolate("select min($__time(time_column))")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select min(UNIX_TIMESTAMP(time_column) as time_sec)")
		})

		Convey("interpolate __timeFilter function", func() {
			engine := &PostgresMacroEngine{
				TimeRange: &tsdb.TimeRange{From: "5m", To: "now"},
			}

			sql, err := engine.Interpolate("WHERE $__timeFilter(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "WHERE time_column >= to_timestamp(18446744066914186738) AND time_column <= to_timestamp(18446744066914187038)")
		})

		Convey("interpolate __timeFrom function", func() {
			engine := &PostgresMacroEngine{
				TimeRange: &tsdb.TimeRange{From: "5m", To: "now"},
			}

			sql, err := engine.Interpolate("select $__timeFrom(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select to_timestamp(18446744066914186738)")
		})

		Convey("interpolate __timeTo function", func() {
			engine := &PostgresMacroEngine{
				TimeRange: &tsdb.TimeRange{From: "5m", To: "now"},
			}

			sql, err := engine.Interpolate("select $__timeTo(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select to_timestamp(18446744066914187038)")
		})

		Convey("interpolate __unixEpochFilter function", func() {
			engine := &PostgresMacroEngine{
				TimeRange: &tsdb.TimeRange{From: "5m", To: "now"},
			}

			sql, err := engine.Interpolate("select $__unixEpochFilter(18446744066914186738)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914186738 >= 18446744066914186738 AND 18446744066914186738 <= 18446744066914187038")
		})

		Convey("interpolate __unixEpochFrom function", func() {
			engine := &PostgresMacroEngine{
				TimeRange: &tsdb.TimeRange{From: "5m", To: "now"},
			}

			sql, err := engine.Interpolate("select $__unixEpochFrom()")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914186738")
		})

		Convey("interpolate __unixEpochTo function", func() {
			engine := &PostgresMacroEngine{
				TimeRange: &tsdb.TimeRange{From: "5m", To: "now"},
			}

			sql, err := engine.Interpolate("select $__unixEpochTo()")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select 18446744066914187038")
		})

	})
}
