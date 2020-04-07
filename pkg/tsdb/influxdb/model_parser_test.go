package influxdb

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryParser(t *testing.T) {
	Convey("Influxdb query parser", t, func() {

		parser := &InfluxdbQueryParser{}
		dsInfo := &models.DataSource{
			JsonData: simplejson.New(),
		}

		Convey("can parse influxdb json model", func() {
			json := `
        {
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
              "none"
            ],
            "type": "fill"
          }
        ],
        "measurement": "logins.count",
        "tz": "Europe/Paris",
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
              "type": "bottom",
              "params": [
                3
              ]
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
        "alias": "serie alias",
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
			dsInfo.JsonData.Set("timeInterval", ">20s")
			modelJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			res, err := parser.Parse(modelJson, dsInfo)
			So(err, ShouldBeNil)
			So(len(res.GroupBy), ShouldEqual, 3)
			So(len(res.Selects), ShouldEqual, 3)
			So(len(res.Tags), ShouldEqual, 2)
			So(res.Tz, ShouldEqual, "Europe/Paris")
			So(res.Interval, ShouldEqual, time.Second*20)
			So(res.Alias, ShouldEqual, "serie alias")
		})

		Convey("can part raw query json model", func() {
			json := `
      {
        "groupBy": [
          {
            "params": [
              "$interval"
            ],
            "type": "time"
          },
          {
            "params": [
              "null"
            ],
            "type": "fill"
          }
        ],
        "interval": ">10s",
        "policy": "default",
        "query": "RawDummieQuery",
        "rawQuery": true,
        "refId": "A",
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
              "type": "mean"
            }
          ]
        ],
        "tags": [

        ]
      }
      `

			modelJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			res, err := parser.Parse(modelJson, dsInfo)
			So(err, ShouldBeNil)
			So(res.RawQuery, ShouldEqual, "RawDummieQuery")
			So(len(res.GroupBy), ShouldEqual, 2)
			So(len(res.Selects), ShouldEqual, 1)
			So(len(res.Tags), ShouldEqual, 0)
			So(res.Interval, ShouldEqual, time.Second*10)
		})
	})
}
