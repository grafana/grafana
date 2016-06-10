package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertModelParsing(t *testing.T) {

	Convey("Parsing alert info from json", t, func() {
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
          "alerting": {
            "name": "alert name",
            "description": "description",
            "frequency": 10,
            "warning": {
              "op": ">",
              "level": 10
            },
            "critical": {
              "op": ">",
              "level": 20
            },
            "function": "static",
            "valueQuery": {
              "queryRefId": "A",
              "from": "5m",
              "to": "now",
              "agg": "avg",
              "params": [
                "#A",
                "5m",
                "now",
                "avg"
              ]
            },
            "evalQuery": {
              "queryRefId": "A",
              "from": "5m",
              "to": "now",
              "agg": "avg",
              "params": [
                "#A",
                "5m",
                "now",
                "avg"
              ]
            },
            "evalStringParam1": "",
            "name": "Alerting Panel Title alert"
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
          "alerting": {
            "name": "alert name",
            "description": "description",
            "frequency": 10,
            "warning": {
              "op": ">",
              "level": 10
            },
            "critical": {
              "op": ">",
              "level": 20
            },
            "function": "static",
            "valueQuery": {
              "queryRefId": "A",
              "from": "5m",
              "to": "now",
              "agg": "avg",
              "params": [
                "#A",
                "5m",
                "now",
                "avg"
              ]
            },
            "evalQuery": {
              "queryRefId": "A",
              "from": "5m",
              "to": "now",
              "agg": "avg",
              "params": [
                "#A",
                "5m",
                "now",
                "avg"
              ]
            },
            "evalStringParam1": "",
            "name": "Alerting Panel Title alert"
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
			dashboardJSON, _ := simplejson.NewJson([]byte(json))
			cmd := &m.SaveDashboardCommand{
				Dashboard: dashboardJSON,
				UserId:    1,
				OrgId:     1,
				Overwrite: true,
				Result: &m.Dashboard{
					Id: 1,
				},
			}

			InitTestDB(t)

			AddDataSource(&m.AddDataSourceCommand{
				Name:      "graphite2",
				OrgId:     1,
				Type:      m.DS_INFLUXDB,
				Access:    m.DS_ACCESS_DIRECT,
				Url:       "http://test",
				IsDefault: false,
				Database:  "site",
			})

			AddDataSource(&m.AddDataSourceCommand{
				Name:      "InfluxDB",
				OrgId:     1,
				Type:      m.DS_GRAPHITE,
				Access:    m.DS_ACCESS_DIRECT,
				Url:       "http://test",
				IsDefault: true,
			})

			alerts := alerting.ParseAlertsFromDashboard(cmd)

			Convey("all properties have been set", func() {
				So(alerts, ShouldNotBeEmpty)
				So(len(alerts), ShouldEqual, 2)

				for _, v := range alerts {
					So(v.DashboardId, ShouldEqual, 1)
					So(v.PanelId, ShouldNotEqual, 0)

					So(v.Name, ShouldNotBeEmpty)
					So(v.Description, ShouldNotBeEmpty)
				}
			})
		})
	})
}
