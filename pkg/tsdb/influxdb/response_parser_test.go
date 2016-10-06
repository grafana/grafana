package influxdb

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbResponseParser(t *testing.T) {
	Convey("Influxdb response parser", t, func() {

		setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../../",
		})

		response := &Response{
			Results: []Result{
				Result{
					Series: []Row{
						{
							Name:    "cpu",
							Columns: []string{"time", "mean", "sum"},
							Values: [][]interface{}{
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
								{json.Number("123"), json.Number("123"), json.Number("123")},
							},
						},
					},
				},
			},
		}

		Convey("can parse response", func() {
			result := ParseQueryResult(response)
			So(len(result.Series), ShouldEqual, 1)
			So(len(result.Series[0].Points), ShouldEqual, 10)
		})
	})
}
