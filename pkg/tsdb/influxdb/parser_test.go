package influxdb

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryParser(t *testing.T) {
	Convey("Influxdb query parser", t, func() {

		parser := &InfluxdbQueryParser{}

		Convey("converting metric name", func() {
			json := `
      {
        "dsType": "influxdb",
        "groupBy": [
          {
            "params": [
              "$interval"
            ],
            "type": "time"
          },
          {
            "type": "tag",
            "params": [
              "datacenter"
            ]
          },
          {
            "params": [
              "null"
            ],
            "type": "fill"
          }
        ],
        "measurement": "logins.count",
        "policy": "default",
        "refId": "B",
        "resultFormat": "time_series",
        "select": [
          [
            {
              "params": [
                "value"
              ],
              "type": "field"
            },
            {
              "params": [

              ],
              "type": "count"
            }
          ],
          [
            {
              "params": [
                "value"
              ],
              "type": "field"
            },
            {
              "params": [

              ],
              "type": "mean"
            }
          ]
        ],
        "tags": [
          {
            "key": "datacenter",
            "operator": "=",
            "value": "America"
          }
        ]
      }
      `

			modelJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			res, err := parser.Parse(modelJson)
			So(err, ShouldBeNil)
			So(len(res.GroupBy), ShouldEqual, 3)
			So(len(res.Selects), ShouldEqual, 2)
			So(len(res.Tags), ShouldEqual, 1)
		})
	})
}
