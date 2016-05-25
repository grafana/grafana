package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertModel(t *testing.T) {

	Convey("Parsing alerts from dashboard", t, func() {
		json := `{
  "id": 57,
  "title": "Graphite 4",
  "originalTitle": "Graphite 4",
  "tags": [
    "graphite"
  ],
  "style": "dark",
  "timezone": "browser",
  "editable": true,
  "hideControls": false,
  "sharedCrosshair": false,
  "rows": [
    {
      "collapse": false,
      "editable": true,
      "height": "250px",
      "panels": [
        {
          "title": "Active desktop users",
          "error": false,
          "span": 6,
          "editable": true,
          "type": "graph",
          "isNew": true,
          "id": 3,
          "targets": [
            {
              "refId": "A",
              "target": "aliasByNode(statsd.fakesite.counters.session_start.desktop.count, 4)"
            }
          ],
          "datasource": null,
          "renderer": "flot",
          "yaxes": [
            {
              "label": null,
              "show": true,
              "logBase": 1,
              "min": null,
              "max": null,
              "format": "short"
            },
            {
              "label": null,
              "show": true,
              "logBase": 1,
              "min": null,
              "max": null,
              "format": "short"
            }
          ],
          "xaxis": {
            "show": true
          },
          "grid": {
            "threshold1": null,
            "threshold2": null,
            "threshold1Color": "rgba(216, 200, 27, 0.27)",
            "threshold2Color": "rgba(234, 112, 112, 0.22)"
          },
          "lines": true,
          "fill": 1,
          "linewidth": 2,
          "points": false,
          "pointradius": 5,
          "bars": false,
          "stack": false,
          "percentage": false,
          "legend": {
            "show": true,
            "values": false,
            "min": false,
            "max": false,
            "current": false,
            "total": false,
            "avg": false
          },
          "nullPointMode": "connected",
          "steppedLine": false,
          "tooltip": {
            "value_type": "cumulative",
            "shared": true,
            "msResolution": false
          },
          "timeFrom": null,
          "timeShift": null,
          "aliasColors": {},
          "seriesOverrides": [],
          "alerting": {
            "queryRef": "A",
            "warnLevel": 30,
            "critLevel": 50,
            "warnOperator": ">",
            "critOperator": ">",
            "aggregator": "sum",
            "queryRange": "10m",
            "interval": "10s",
            "title": "active desktop users",
            "description": "restart webservers"
          },
          "links": []
        },
        {
          "title": "Active mobile users",
          "error": false,
          "span": 6,
          "editable": true,
          "type": "graph",
          "isNew": true,
          "id": 4,
          "targets": [
            {
              "refId": "A",
              "target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"
            }
          ],
          "datasource": "graphite2",
          "renderer": "flot",
          "yaxes": [
            {
              "label": null,
              "show": true,
              "logBase": 1,
              "min": null,
              "max": null,
              "format": "short"
            },
            {
              "label": null,
              "show": true,
              "logBase": 1,
              "min": null,
              "max": null,
              "format": "short"
            }
          ],
          "xaxis": {
            "show": true
          },
          "grid": {
            "threshold1": null,
            "threshold2": null,
            "threshold1Color": "rgba(216, 200, 27, 0.27)",
            "threshold2Color": "rgba(234, 112, 112, 0.22)"
          },
          "lines": true,
          "fill": 1,
          "linewidth": 2,
          "points": false,
          "pointradius": 5,
          "bars": false,
          "stack": false,
          "percentage": false,
          "legend": {
            "show": true,
            "values": false,
            "min": false,
            "max": false,
            "current": false,
            "total": false,
            "avg": false
          },
          "nullPointMode": "connected",
          "steppedLine": false,
          "tooltip": {
            "value_type": "cumulative",
            "shared": true,
            "msResolution": false
          },
          "timeFrom": null,
          "timeShift": null,
          "aliasColors": {
            "mobile": "#EAB839"
          },
          "seriesOverrides": [],
          "alerting": {
            "queryRef": "A",
            "warnOperator": ">",
            "critOperator": ">",
            "warnLevel": 300,
            "critLevel": 500,
            "aggregator": "avg",
            "queryRange": "10m",
            "interval": "10s",
            "title": "active mobile users",
            "description": "restart itunes"
          },
          "links": []
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
          "columns": [],
          "datasource": "InfluxDB",
          "editable": true,
          "error": false,
          "fontSize": "100%",
          "id": 2,
          "isNew": true,
          "pageSize": null,
          "scroll": true,
          "showHeader": true,
          "sort": {
            "col": 0,
            "desc": true
          },
          "span": 6,
          "styles": [
            {
              "dateFormat": "YYYY-MM-DD HH:mm:ss",
              "pattern": "Time",
              "type": "date"
            },
            {
              "colorMode": null,
              "colors": [
                "rgba(245, 54, 54, 0.9)",
                "rgba(237, 129, 40, 0.89)",
                "rgba(50, 172, 45, 0.97)"
              ],
              "decimals": 2,
              "pattern": "/.*/",
              "thresholds": [],
              "type": "number",
              "unit": "short"
            }
          ],
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
          "type": "table",
          "links": []
        }
      ],
      "title": "New row"
    }
  ],
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "timepicker": {
    "now": true,
    "nowDelay": "5m",
    "refresh_intervals": [
      "5s",
      "10s",
      "30s",
      "1m",
      "5m",
      "15m",
      "30m",
      "1h",
      "2h",
      "1d",
      "7d"
    ],
    "time_options": [
      "5m",
      "15m",
      "1h",
      "6h",
      "12h",
      "24h",
      "2d",
      "7d",
      "30d"
    ]
  },
  "templating": {
    "list": []
  },
  "annotations": {
    "list": []
  },
  "schemaVersion": 12,
  "version": 16,
  "links": []
}`
		dashboardJson, _ := simplejson.NewJson([]byte(json))
		cmd := &m.SaveDashboardCommand{
			Dashboard: dashboardJson,
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

				So(v.WarnLevel, ShouldNotBeEmpty)
				So(v.CritLevel, ShouldNotBeEmpty)

				So(v.Aggregator, ShouldNotBeEmpty)
				So(v.Query, ShouldNotBeEmpty)
				So(v.QueryRefId, ShouldNotBeEmpty)
				So(v.QueryRange, ShouldNotBeEmpty)
				So(v.Title, ShouldNotBeEmpty)
				So(v.Description, ShouldNotBeEmpty)
			}

			So(alerts[0].WarnLevel, ShouldEqual, 30)
			So(alerts[1].WarnLevel, ShouldEqual, 300)

			So(alerts[0].CritLevel, ShouldEqual, 50)
			So(alerts[1].CritLevel, ShouldEqual, 500)

			So(alerts[0].CritOperator, ShouldEqual, ">")
			So(alerts[1].CritOperator, ShouldEqual, ">")
			So(alerts[0].WarnOperator, ShouldEqual, ">")
			So(alerts[1].WarnOperator, ShouldEqual, ">")

			So(alerts[0].Query, ShouldEqual, `{"refId":"A","target":"aliasByNode(statsd.fakesite.counters.session_start.desktop.count, 4)"}`)
			So(alerts[1].Query, ShouldEqual, `{"refId":"A","target":"aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}`)

			So(alerts[0].DatasourceId, ShouldEqual, 2)
			So(alerts[1].DatasourceId, ShouldEqual, 1)

		})
	})
}
