package tsdb

import (
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

func TestSqlEngine(t *testing.T) {
	Convey("SqlEngine", t, func() {
		Convey("Given row values with time columns when converting them", func() {
			dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)
			fixtures := make([]interface{}, 8)
			fixtures[0] = dt
			fixtures[1] = dt.Unix() * 1000
			fixtures[2] = dt.Unix()
			fixtures[3] = float64(dt.Unix() * 1000)
			fixtures[4] = float64(dt.Unix())

			var nilDt *time.Time
			var nilInt64 *int64
			var nilFloat64 *float64
			fixtures[5] = nilDt
			fixtures[6] = nilInt64
			fixtures[7] = nilFloat64

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("Should convert sql time columns to epoch time in ms ", func() {
				expected := float64(dt.Unix() * 1000)
				So(fixtures[0].(float64), ShouldEqual, expected)
				So(fixtures[1].(int64), ShouldEqual, expected)
				So(fixtures[2].(int64), ShouldEqual, expected)
				So(fixtures[3].(float64), ShouldEqual, expected)
				So(fixtures[4].(float64), ShouldEqual, expected)

				So(fixtures[5], ShouldBeNil)
				So(fixtures[6], ShouldBeNil)
				So(fixtures[7], ShouldBeNil)
			})
		})
	})
}
