package cassandra

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/inf.v0"
	"math/big"
)

func TestPointerNumericToFloat64(t *testing.T) {
	Convey("ToFloat64", t, func() {
		Convey("dereference of **inf.Dec", func() {
			val := new(inf.Dec)
			val.SetString("12.34")
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(12.34))
		})

		Convey("dereference of *big.Int", func() {
			val := new(big.Int)
			val.SetString("1234", 10)
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(1234))
		})

		Convey("dereference of *float64", func() {
			val := float64(-9223372036854775808)
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(-9223372036854775808))
		})

		Convey("dereference of *float32", func() {
			val := float32(-9223372036854775808)
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(-9223372036854775808))
		})

		Convey("dereference of *int64", func() {
			val := int64(-9223372036854775808)
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(-9223372036854775808))
		})

		Convey("dereference of *int32", func() {
			val := int32(-2147483648)
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(-2147483648))
		})

		Convey("dereference of *int16", func() {
			val := int16(-32768)
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(-32768))
		})

		Convey("dereference of *int8", func() {
			val := int8(-128)
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(-128))
		})

		Convey("dereference of *int", func() {
			val := int(-2147483648)
			f64, ok := ToFloat64(&val)

			So(ok, ShouldEqual, true)
			So(f64, ShouldEqual, float64(-2147483648))
		})

		Convey("numeric dereference of *string should fail", func() {
			val := string("1")
			_, ok := ToFloat64(&val)

			So(ok, ShouldEqual, false)
		})

	})
}
