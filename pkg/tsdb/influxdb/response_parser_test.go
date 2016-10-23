package influxdb

import (
	"encoding/json"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbResponseParser(t *testing.T) {
	Convey("Influxdb response parser", t, func() {

		parser := &ResponseParser{}

		response := &Response{
			Results: []Result{
				Result{
					Series: []Row{
						{
							Name:    "cpu",
							Columns: []string{"time", "mean", "sum"},
							Tags:    map[string]string{"datacenter": "America"},
							Values: [][]interface{}{
								{json.Number("111"), json.Number("222"), json.Number("333")},
								{json.Number("111"), json.Number("222"), json.Number("333")},
								{json.Number("111"), json.Number("null"), json.Number("333")},
							},
						},
					},
				},
			},
		}

		result := parser.Parse(response)

		Convey("can parse all series", func() {
			So(len(result.Series), ShouldEqual, 2)
		})

		Convey("can parse all points", func() {
			So(len(result.Series[0].Points), ShouldEqual, 3)
			So(len(result.Series[1].Points), ShouldEqual, 3)
		})

		Convey("can parse multi row result", func() {
			So(result.Series[0].Points[1][0].Float64, ShouldEqual, float64(222))
			So(result.Series[1].Points[1][0].Float64, ShouldEqual, float64(333))
		})

		Convey("can parse null points", func() {
			So(result.Series[0].Points[2][0].Valid, ShouldBeFalse)
		})

		Convey("can format serie names", func() {
			So(result.Series[0].Name, ShouldEqual, "cpu.mean { datacenter: America }")
			So(result.Series[1].Name, ShouldEqual, "cpu.sum { datacenter: America }")
		})
	})
}
