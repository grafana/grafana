package influxdb

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbResponseParser(t *testing.T) {
	Convey("Influxdb response parser", t, func() {
		Convey("Response parser", func() {
			parser := &ResponseParser{}

			cfg := setting.NewCfg()
			err := cfg.Load(&setting.CommandLineArgs{
				HomePath: "../../../",
			})
			So(err, ShouldBeNil)

			response := &Response{
				Results: []Result{
					{
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

			query := &Query{}

			result := parser.Parse(response, query)

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

			Convey("can format series names", func() {
				So(result.Series[0].Name, ShouldEqual, "cpu.mean { datacenter: America }")
				So(result.Series[1].Name, ShouldEqual, "cpu.sum { datacenter: America }")
			})
		})

		Convey("Response parser with alias", func() {
			parser := &ResponseParser{}

			response := &Response{
				Results: []Result{
					{
						Series: []Row{
							{
								Name:    "cpu.upc",
								Columns: []string{"time", "mean", "sum"},
								Tags: map[string]string{
									"datacenter":     "America",
									"dc.region.name": "Northeast",
								},
								Values: [][]interface{}{
									{json.Number("111"), json.Number("222"), json.Number("333")},
								},
							},
						},
					},
				},
			}

			Convey("$ alias", func() {
				Convey("simple alias", func() {
					query := &Query{Alias: "series alias"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "series alias")
				})

				Convey("measurement alias", func() {
					query := &Query{Alias: "alias $m $measurement", Measurement: "10m"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias 10m 10m")
				})

				Convey("column alias", func() {
					query := &Query{Alias: "alias $col", Measurement: "10m"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias mean")
					So(result.Series[1].Name, ShouldEqual, "alias sum")
				})

				Convey("tag alias", func() {
					query := &Query{Alias: "alias $tag_datacenter"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias America")
				})

				Convey("segment alias", func() {
					query := &Query{Alias: "alias $1"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias upc")
				})

				Convey("segment position out of bound", func() {
					query := &Query{Alias: "alias $5"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias $5")
				})
			})

			Convey("[[]] alias", func() {
				Convey("simple alias", func() {
					query := &Query{Alias: "series alias"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "series alias")
				})

				Convey("measurement alias", func() {
					query := &Query{Alias: "alias [[m]] [[measurement]]", Measurement: "10m"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias 10m 10m")
				})

				Convey("column alias", func() {
					query := &Query{Alias: "alias [[col]]", Measurement: "10m"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias mean")
					So(result.Series[1].Name, ShouldEqual, "alias sum")
				})

				Convey("tag alias", func() {
					query := &Query{Alias: "alias [[tag_datacenter]]"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias America")
				})

				Convey("tag alias with periods", func() {
					query := &Query{Alias: "alias [[tag_dc.region.name]]"}
					result := parser.Parse(response, query)

					So(result.Series[0].Name, ShouldEqual, "alias Northeast")
				})
			})
		})

		Convey("Response parser with errors", func() {
			parser := &ResponseParser{}

			cfg := setting.NewCfg()
			err := cfg.Load(&setting.CommandLineArgs{
				HomePath: "../../../",
			})
			So(err, ShouldBeNil)

			response := &Response{
				Results: []Result{
					{
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
					{
						Err: fmt.Errorf("query-timeout limit exceeded"),
					},
				},
			}

			query := &Query{}

			result := parser.Parse(response, query)

			Convey("can parse all series", func() {
				So(len(result.Series), ShouldEqual, 2)
			})

			Convey("can parse all points", func() {
				So(len(result.Series[0].Points), ShouldEqual, 3)
				So(len(result.Series[1].Points), ShouldEqual, 3)
			})

			Convey("can parse errors ", func() {
				So(result.Error, ShouldNotBeNil)
				So(result.Error.Error(), ShouldEqual, "query-timeout limit exceeded")
			})
		})
	})
}
