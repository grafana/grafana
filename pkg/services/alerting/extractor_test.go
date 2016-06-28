package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertRuleExtraction(t *testing.T) {

	Convey("Parsing alert rules  from dashboard json", t, func() {
		Convey("Parsing and validating alerts from dashboards", func() {
			json := `{
  "id": 57,
  "title": "Graphite 4",
  "originalTitle": "Graphite 4",
  "tags": [
    "graphite"
  ],
  "rows": [
    {

      "panels": [
        {
          "title": "Active desktop users",
          "editable": true,
          "type": "graph",
          "id": 3,
          "targets": [
            {
              "refId": "A",
              "target": "aliasByNode(statsd.fakesite.counters.session_start.desktop.count, 4)"
            }
          ],
          "datasource": null,
          "alert": {
            "name": "name1",
            "description": "desc1",
						"handler": 1,
						"enabled": true,
            "critical": {
              "value": 20,
              "op": ">"
            },
            "frequency": "60s",
            "query": {
              "from": "5m",
              "refId": "A",
              "to": "now"
            },
            "transform": {
              "type": "avg",
              "name": "aggregation"
            },
            "warn": {
              "value": 10,
              "op": ">"
            }
          }
        },
        {
          "title": "Active mobile users",
          "id": 4,
          "targets": [
            {
              "refId": "A",
              "target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"
            }
          ],
          "datasource": "graphite2",
          "alert": {
            "name": "name2",
            "description": "desc2",
						"handler": 0,
						"enabled": true,
            "critical": {
              "value": 20,
              "op": ">"
            },
            "frequency": "60s",
            "query": {
              "from": "5m",
              "refId": "A",
              "to": "now"
            },
            "transform": {
              "type": "avg",
              "name": "aggregation"
            },
            "warn": {
              "value": 10,
              "op": ">"
            }
          }
        }
      ],
      "title": "Row"
    },
    {
      "collapse": false,
      "editable": true,
      "height": "250px",
      "panels": [
        {
          "datasource": "InfluxDB",
          "id": 2,
          "alert": {
            "name": "name2",
            "description": "desc2",
						"enabled": false,
            "critical": {
              "level": 20,
              "op": ">"
            },
            "warn": {
              "level": 10,
              "op": ">"
            }
          },
          "targets": [
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
                    "null"
                  ],
                  "type": "fill"
                }
              ],
              "measurement": "cpu",
              "policy": "default",
              "query": "SELECT mean(\"value\") FROM \"cpu\" WHERE $timeFilter GROUP BY time($interval) fill(null)",
              "refId": "A",
              "resultFormat": "table",
              "select": [
                [
                  {
                    "params": [
                      "value"
                    ],
                    "type": "field"
                  },
                  {
                    "params": [],
                    "type": "mean"
                  }
                ]
              ],
              "tags": [],
              "target": ""
            }
          ],
          "title": "Broken influxdb panel",
          "transform": "table",
          "type": "table"
        }
      ],
      "title": "New row"
    }
  ]

}`
			dashJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			dash := m.NewDashboardFromJson(dashJson)
			extractor := NewDashAlertExtractor(dash, 1)

			// mock data
			defaultDs := &m.DataSource{Id: 12, OrgId: 2, Name: "I am default", IsDefault: true}
			graphite2Ds := &m.DataSource{Id: 15, OrgId: 2, Name: "graphite2"}

			bus.AddHandler("test", func(query *m.GetDataSourcesQuery) error {
				query.Result = []*m.DataSource{defaultDs, graphite2Ds}
				return nil
			})

			bus.AddHandler("test", func(query *m.GetDataSourceByNameQuery) error {
				if query.Name == defaultDs.Name {
					query.Result = defaultDs
				}
				if query.Name == graphite2Ds.Name {
					query.Result = graphite2Ds
				}
				return nil
			})

			alerts, err := extractor.GetAlerts()

			Convey("Get rules without error", func() {
				So(err, ShouldBeNil)
			})

			Convey("all properties have been set", func() {
				So(len(alerts), ShouldEqual, 2)

				for _, v := range alerts {
					So(v.DashboardId, ShouldEqual, 57)
					So(v.Name, ShouldNotBeEmpty)
					So(v.Description, ShouldNotBeEmpty)
				}

				Convey("should extract handler property", func() {
					So(alerts[0].Handler, ShouldEqual, 1)
					So(alerts[1].Handler, ShouldEqual, 0)
				})

				Convey("should extract frequency in seconds", func() {
					So(alerts[0].Frequency, ShouldEqual, 60)
					So(alerts[1].Frequency, ShouldEqual, 60)
				})

				Convey("should extract panel idc", func() {
					So(alerts[0].PanelId, ShouldEqual, 3)
					So(alerts[1].PanelId, ShouldEqual, 4)
				})

				Convey("should extract name and desc", func() {
					So(alerts[0].Name, ShouldEqual, "name1")
					So(alerts[0].Description, ShouldEqual, "desc1")
					So(alerts[1].Name, ShouldEqual, "name2")
					So(alerts[1].Description, ShouldEqual, "desc2")
				})
			})
		})
	})
}
