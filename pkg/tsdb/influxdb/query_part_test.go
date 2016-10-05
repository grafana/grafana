package influxdb

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryPart(t *testing.T) {
	Convey("Influxdb query part builder", t, func() {

		Convey("should handle field renderer parts", func() {
			part := QueryPart{
				Type:   "field",
				Params: []string{"value"},
			}

			res, _ := part.Render("value")
			So(res, ShouldEqual, `"value"`)
		})

		Convey("should handle nested function parts", func() {
			part := QueryPart{
				Type:   "derivative",
				Params: []string{"10s"},
			}

			res, _ := part.Render("mean(value)")
			So(res, ShouldEqual, "derivative(mean(value), 10s)")
		})

		Convey("should nest spread function", func() {
			part := QueryPart{
				Type: "spread",
			}

			res, err := part.Render("value")
			So(err, ShouldBeNil)
			So(res, ShouldEqual, "spread(value)")
		})

		Convey("should handle suffix parts", func() {
			part := QueryPart{
				Type:   "math",
				Params: []string{"/ 100"},
			}

			res, _ := part.Render("mean(value)")
			So(res, ShouldEqual, "mean(value) / 100")
		})

		Convey("should handle alias parts", func() {
			part := QueryPart{
				Type:   "alias",
				Params: []string{"test"},
			}

			res, _ := part.Render("mean(value)")
			So(res, ShouldEqual, `mean(value) AS "test"`)
		})
	})
}
