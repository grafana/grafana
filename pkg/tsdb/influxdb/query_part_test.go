package influxdb

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryPart(t *testing.T) {
	Convey("Influxdb query part builder", t, func() {

		Convey("should handle field renderer parts", func() {
			part, err := NewQueryPart("field", []string{"value"})
			So(err, ShouldBeNil)

			res := part.Render("value")
			So(res, ShouldEqual, `"value"`)
		})

		Convey("should handle nested function parts", func() {
			part, err := NewQueryPart("derivative", []string{"10s"})
			So(err, ShouldBeNil)

			res := part.Render("mean(value)")
			So(res, ShouldEqual, "derivative(mean(value), 10s)")
		})

		Convey("bottom", func() {
			part, err := NewQueryPart("bottom", []string{"3"})
			So(err, ShouldBeNil)

			res := part.Render("value")
			So(res, ShouldEqual, "bottom(value, 3)")
		})

		Convey("time", func() {
			part, err := NewQueryPart("time", []string{"$interval"})
			So(err, ShouldBeNil)

			res := part.Render("")
			So(res, ShouldEqual, "time(10s)")
		})

		Convey("should nest spread function", func() {
			part, err := NewQueryPart("spread", []string{})
			So(err, ShouldBeNil)

			res := part.Render("value")
			So(res, ShouldEqual, `spread(value)`)
		})

		Convey("should handle suffix parts", func() {
			part, err := NewQueryPart("math", []string{"/ 100"})
			So(err, ShouldBeNil)

			res := part.Render("mean(value)")
			So(res, ShouldEqual, "mean(value) / 100")
		})

		Convey("should handle alias parts", func() {
			part, err := NewQueryPart("alias", []string{"test"})
			So(err, ShouldBeNil)

			res := part.Render("mean(value)")
			So(res, ShouldEqual, `mean(value) AS "test"`)
		})
	})
}
