package tsdb

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestSqlEngine(t *testing.T) {
	Convey("SqlEngine", t, func() {
		dt := time.Date(2018, 3, 14, 21, 20, 6, int(527345*time.Microsecond), time.UTC)
		earlyDt := time.Date(1970, 3, 14, 21, 20, 6, int(527345*time.Microsecond), time.UTC)

		Convey("Given a time range between 2018-04-12 00:00 and 2018-04-12 00:05", func() {
			from := time.Date(2018, 4, 12, 18, 0, 0, 0, time.UTC)
			to := from.Add(5 * time.Minute)
			timeRange := NewFakeTimeRange("5m", "now", to)
			query := &Query{DataSource: &models.DataSource{}, Model: simplejson.New()}

			Convey("interpolate $__interval", func() {
				sql, err := Interpolate(query, timeRange, "select $__interval ")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select 1m ")
			})

			Convey("interpolate $__interval in $__timeGroup", func() {
				sql, err := Interpolate(query, timeRange, "select $__timeGroupAlias(time,$__interval)")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select $__timeGroupAlias(time,1m)")
			})

			Convey("interpolate $__interval_ms", func() {
				sql, err := Interpolate(query, timeRange, "select $__interval_ms ")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, "select 60000 ")
			})

			Convey("interpolate __unixEpochFrom function", func() {
				sql, err := Interpolate(query, timeRange, "select $__unixEpochFrom()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", from.Unix()))
			})

			Convey("interpolate __unixEpochTo function", func() {
				sql, err := Interpolate(query, timeRange, "select $__unixEpochTo()")
				So(err, ShouldBeNil)

				So(sql, ShouldEqual, fmt.Sprintf("select %d", to.Unix()))
			})

		})

		Convey("Given row values with time.Time as time columns", func() {
			var nilPointer *time.Time

			fixtures := make([]interface{}, 5)
			fixtures[0] = dt
			fixtures[1] = &dt
			fixtures[2] = earlyDt
			fixtures[3] = &earlyDt
			fixtures[4] = nilPointer

			for i := range fixtures {
				ConvertSqlTimeColumnToEpochMs(fixtures, i)
			}

			Convey("When converting them should return epoch time with millisecond precision ", func() {
				expected := float64(dt.UnixNano()) / float64(time.Millisecond)
				expectedEarly := float64(earlyDt.UnixNano()) / float64(time.Millisecond)

				So(fixtures[0].(float64), ShouldEqual, expected)
				So(fixtures[1].(float64), ShouldEqual, expected)
				So(fixtures[2].(float64), ShouldEqual, expectedEarly)
				So(fixtures[3].(float64), ShouldEqual, expectedEarly)
				So(fixtures[4], ShouldBeNil)
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
			tSeconds := float64(dt.UnixNano()) / float64(time.Second)
			tMilliseconds := float64(dt.UnixNano()) / float64(time.Millisecond)
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
				So(fixtures[0].(float64), ShouldEqual, tMilliseconds)
				So(fixtures[1].(float64), ShouldEqual, tMilliseconds)
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

		Convey("Given row with value columns", func() {
			intValue := 1
			int64Value := int64(1)
			int32Value := int32(1)
			int16Value := int16(1)
			int8Value := int8(1)
			float64Value := float64(1)
			float32Value := float32(1)
			uintValue := uint(1)
			uint64Value := uint64(1)
			uint32Value := uint32(1)
			uint16Value := uint16(1)
			uint8Value := uint8(1)

			fixtures := make([]interface{}, 24)
			fixtures[0] = intValue
			fixtures[1] = &intValue
			fixtures[2] = int64Value
			fixtures[3] = &int64Value
			fixtures[4] = int32Value
			fixtures[5] = &int32Value
			fixtures[6] = int16Value
			fixtures[7] = &int16Value
			fixtures[8] = int8Value
			fixtures[9] = &int8Value
			fixtures[10] = float64Value
			fixtures[11] = &float64Value
			fixtures[12] = float32Value
			fixtures[13] = &float32Value
			fixtures[14] = uintValue
			fixtures[15] = &uintValue
			fixtures[16] = uint64Value
			fixtures[17] = &uint64Value
			fixtures[18] = uint32Value
			fixtures[19] = &uint32Value
			fixtures[20] = uint16Value
			fixtures[21] = &uint16Value
			fixtures[22] = uint8Value
			fixtures[23] = &uint8Value

			var intNilPointer *int
			var int64NilPointer *int64
			var int32NilPointer *int32
			var int16NilPointer *int16
			var int8NilPointer *int8
			var float64NilPointer *float64
			var float32NilPointer *float32
			var uintNilPointer *uint
			var uint64NilPointer *uint64
			var uint32NilPointer *uint32
			var uint16NilPointer *uint16
			var uint8NilPointer *uint8

			nilPointerFixtures := make([]interface{}, 12)
			nilPointerFixtures[0] = intNilPointer
			nilPointerFixtures[1] = int64NilPointer
			nilPointerFixtures[2] = int32NilPointer
			nilPointerFixtures[3] = int16NilPointer
			nilPointerFixtures[4] = int8NilPointer
			nilPointerFixtures[5] = float64NilPointer
			nilPointerFixtures[6] = float32NilPointer
			nilPointerFixtures[7] = uintNilPointer
			nilPointerFixtures[8] = uint64NilPointer
			nilPointerFixtures[9] = uint32NilPointer
			nilPointerFixtures[10] = uint16NilPointer
			nilPointerFixtures[11] = uint8NilPointer

			Convey("When converting values to float should return expected value", func() {
				for _, f := range fixtures {
					value, _ := ConvertSqlValueColumnToFloat("col", f)

					if !value.Valid {
						t.Fatalf("Failed to convert %T value, expected a valid float value", f)
					}

					if value.Float64 != null.FloatFrom(1).Float64 {
						t.Fatalf("Failed to convert %T value, expected a float value of 1.000, but got %v", f, value)
					}
				}
			})

			Convey("When converting nil pointer values to float should return expected value", func() {
				for _, f := range nilPointerFixtures {
					value, err := ConvertSqlValueColumnToFloat("col", f)

					if err != nil {
						t.Fatalf("Failed to convert %T value, expected a non nil error, but got %v", f, err)
					}

					if value.Valid {
						t.Fatalf("Failed to convert %T value, expected an invalid float value", f)
					}
				}
			})
		})
	})
}
