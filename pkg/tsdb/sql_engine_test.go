package tsdb

import (
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

func TestSqlEngine(t *testing.T) {
	Convey("SqlEngine", t, func() {
		dt := time.Date(2018, 3, 14, 21, 20, 6, 527e6, time.UTC)

		Convey("Given row values with time.Time as time columns", func() {
			var nilPointer *time.Time

			fixtures := make([]interface{}, 3)
			fixtures[0] = dt
			fixtures[1] = &dt
			fixtures[2] = nilPointer

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("When converting them should return epoch time with millisecond precision ", func() {
				expected := float64(dt.UnixNano() / 1e6)
				So(fixtures[0].(float64), ShouldEqual, expected)
				So(fixtures[1].(float64), ShouldEqual, expected)
				So(fixtures[2], ShouldBeNil)
			})
		})

		Convey("Given row values with int64 as time columns", func() {
			tSeconds := dt.Unix()
			tMilliseconds := dt.UnixNano() / 1e6
			tNanoSeconds := dt.UnixNano()
			var nilPointer *int64

			fixtures := make([]interface{}, 7)
			fixtures[0] = tSeconds
			fixtures[1] = &tSeconds
			fixtures[2] = tMilliseconds
			fixtures[3] = &tMilliseconds
			fixtures[4] = tNanoSeconds
			fixtures[5] = &tNanoSeconds
			fixtures[6] = nilPointer

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("When converting them should return epoch time with millisecond precision ", func() {
				So(fixtures[0].(int64), ShouldEqual, tSeconds*1e3)
				So(fixtures[1].(int64), ShouldEqual, tSeconds*1e3)
				So(fixtures[2].(int64), ShouldEqual, tMilliseconds)
				So(fixtures[3].(int64), ShouldEqual, tMilliseconds)
				So(fixtures[4].(int64), ShouldEqual, tMilliseconds)
				So(fixtures[5].(int64), ShouldEqual, tMilliseconds)
				So(fixtures[6], ShouldBeNil)
			})
		})

		Convey("Given row values with uin64 as time columns", func() {
			tSeconds := uint64(dt.Unix())
			tMilliseconds := uint64(dt.UnixNano() / 1e6)
			tNanoSeconds := uint64(dt.UnixNano())
			var nilPointer *uint64

			fixtures := make([]interface{}, 7)
			fixtures[0] = tSeconds
			fixtures[1] = &tSeconds
			fixtures[2] = tMilliseconds
			fixtures[3] = &tMilliseconds
			fixtures[4] = tNanoSeconds
			fixtures[5] = &tNanoSeconds
			fixtures[6] = nilPointer

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("When converting them should return epoch time with millisecond precision ", func() {
				So(fixtures[0].(int64), ShouldEqual, tSeconds*1e3)
				So(fixtures[1].(int64), ShouldEqual, tSeconds*1e3)
				So(fixtures[2].(int64), ShouldEqual, tMilliseconds)
				So(fixtures[3].(int64), ShouldEqual, tMilliseconds)
				So(fixtures[4].(int64), ShouldEqual, tMilliseconds)
				So(fixtures[5].(int64), ShouldEqual, tMilliseconds)
				So(fixtures[6], ShouldBeNil)
			})
		})

		Convey("Given row values with int32 as time columns", func() {
			tSeconds := int32(dt.Unix())
			var nilInt *int32

			fixtures := make([]interface{}, 3)
			fixtures[0] = tSeconds
			fixtures[1] = &tSeconds
			fixtures[2] = nilInt

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("When converting them should return epoch time with millisecond precision ", func() {
				So(fixtures[0].(int64), ShouldEqual, dt.Unix()*1e3)
				So(fixtures[1].(int64), ShouldEqual, dt.Unix()*1e3)
				So(fixtures[2], ShouldBeNil)
			})
		})

		Convey("Given row values with uint32 as time columns", func() {
			tSeconds := uint32(dt.Unix())
			var nilInt *uint32

			fixtures := make([]interface{}, 3)
			fixtures[0] = tSeconds
			fixtures[1] = &tSeconds
			fixtures[2] = nilInt

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("When converting them should return epoch time with millisecond precision ", func() {
				So(fixtures[0].(int64), ShouldEqual, dt.Unix()*1e3)
				So(fixtures[1].(int64), ShouldEqual, dt.Unix()*1e3)
				So(fixtures[2], ShouldBeNil)
			})
		})

		Convey("Given row values with float64 as time columns", func() {
			tSeconds := float64(dt.Unix())
			tMilliseconds := float64(dt.UnixNano() / 1e6)
			tNanoSeconds := float64(dt.UnixNano())
			var nilPointer *float64

			fixtures := make([]interface{}, 7)
			fixtures[0] = tSeconds
			fixtures[1] = &tSeconds
			fixtures[2] = tMilliseconds
			fixtures[3] = &tMilliseconds
			fixtures[4] = tNanoSeconds
			fixtures[5] = &tNanoSeconds
			fixtures[6] = nilPointer

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("When converting them should return epoch time with millisecond precision ", func() {
				So(fixtures[0].(float64), ShouldEqual, tSeconds*1e3)
				So(fixtures[1].(float64), ShouldEqual, tSeconds*1e3)
				So(fixtures[2].(float64), ShouldEqual, tMilliseconds)
				So(fixtures[3].(float64), ShouldEqual, tMilliseconds)
				So(fixtures[4].(float64), ShouldEqual, tMilliseconds)
				So(fixtures[5].(float64), ShouldEqual, tMilliseconds)
				So(fixtures[6], ShouldBeNil)
			})
		})

		Convey("Given row values with float32 as time columns", func() {
			tSeconds := float32(dt.Unix())
			var nilInt *float32

			fixtures := make([]interface{}, 3)
			fixtures[0] = tSeconds
			fixtures[1] = &tSeconds
			fixtures[2] = nilInt

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("When converting them should return epoch time with millisecond precision ", func() {
				So(fixtures[0].(float64), ShouldEqual, float32(dt.Unix()*1e3))
				So(fixtures[1].(float64), ShouldEqual, float32(dt.Unix()*1e3))
				So(fixtures[2], ShouldBeNil)
			})
		})
	})
}
