package cassandra

import (
	"testing"

	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {

		Convey("interpolate __time function", func() {
			engine := &CassandraMacroEngine{}

			sql, err := engine.Interpolate("select $__time(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select toUnixTimestamp(time_column) as time_ms")
		})

		Convey("interpolate __time function wrapped in aggregation", func() {
			engine := &CassandraMacroEngine{}

			sql, err := engine.Interpolate("select min($__time(time_column))")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select min(toUnixTimestamp(time_column) as time_ms)")
		})

		Convey("interpolate __timeFilter function", func() {
			engine := &CassandraMacroEngine{
				TimeRange: &tsdb.TimeRange{From: "5m", To: "now"},
			}

			sql, err := engine.Interpolate("WHERE $__timeFilter(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "WHERE time_column > 18446737278344672745 AND time_column <= 18446737278344972745")
		})

	})
}
