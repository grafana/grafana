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
                  "params": [
                    "datacenter"
                  ],
                  "type": "tag"
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
                    "type": "field",
                    "params": [
                      "value"
                    ]
                  },
                  {
                    "type": "count",
                    "params": []
                  }
                ],
                [
                  {
                    "type": "field",
                    "params": [
                      "value"
                    ]
                  },
                  {
                    "type": "mean",
                    "params": []
                  }
                ],
                [
                  {
                    "type": "field",
                    "params": [
                      "value"
                    ]
                  },
                  {
                    "type": "mean",
                    "params": []
                  },
                  {
                    "type": "math",
                    "params": [
                      " / 100"
                    ]
                  }
                ]
              ],
              "tags": [
                {
                  "key": "datacenter",
                  "operator": "=",
                  "value": "America"
                },
                {
                  "condition": "OR",
                  "key": "hostname",
                  "operator": "=",
                  "value": "server1"
                }
              ]
            }
      `

			modelJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			res, err := parser.Parse(modelJson)
			So(err, ShouldBeNil)
			So(len(res.GroupBy), ShouldEqual, 3)
			So(len(res.Selects), ShouldEqual, 3)
			So(len(res.Tags), ShouldEqual, 2)
		})
	})
}
