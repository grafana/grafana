package mysql

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestMacroEngine(t *testing.T) {
	Convey("MacroEngine", t, func() {

		Convey("interpolate simple function", func() {
			engine := &MySqlMacroEngine{}

			sql, err := engine.Interpolate("select $__time(time_column)")
			So(err, ShouldBeNil)

			So(sql, ShouldEqual, "select UNIX_TIMESTAMP(time_column) as time_sec")
		})

	})
}
