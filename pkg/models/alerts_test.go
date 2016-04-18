package models

import (
	"testing"

	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertModel(t *testing.T) {

	Convey("Parsing alerts from dashboard", t, func() {
		json := `{
  "id": 7,
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
          "aliasColors": {},
          "bars": false,
          "datasource": null,
          "editable": true,
          "error": false,
          "fill": 1,
          "grid": {
            "threshold1": null,
            "threshold1Color": "rgba(216, 200, 27, 0.27)",
            "threshold2": null,
            "threshold2Color": "rgba(234, 112, 112, 0.22)"
          },
          "id": 1,
          "isNew": true,
          "legend": {
            "alignAsTable": true,
            "avg": false,
            "current": false,
            "max": false,
            "min": false,
            "rightSide": true,
            "show": true,
            "total": false,
            "values": false
          },
          "lines": true,
          "linewidth": 2,
          "nullPointMode": "connected",
          "percentage": false,
          "pointradius": 5,
          "points": false,
          "renderer": "flot",
          "seriesOverrides": [],
          "span": 12,
          "stack": false,
          "steppedLine": false,
          "alerts": [
            {
              "query_ref": "A",
              "warn_level": 30,
              "error_level": 50,
              "title": "desktop visiter alerts",
              "description": "Restart the webservers",
              "query_range": "5m",
              "aggregator": "avg",
              "interval": 10
            },
            {
              "query_ref": "B",
              "warn_level": 30,
              "error_level": 50,
              "title": "mobile visiter alerts",
              "description": "Restart the webservers",
              "query_range": "5m",
              "aggregator": "avg",
              "interval": 10
            }
          ],
          "targets": [
            {
              "hide": false,
              "refId": "A",
              "target": "statsd.fakesite.counters.session_start.desktop.count"
            },
            {
              "hide": false,
              "refId": "B",
              "target": "statsd.fakesite.counters.session_start.mobile.count"
            }
          ],
          "timeFrom": null,
          "timeShift": null,
          "title": "Panel Title",
          "tooltip": {
            "msResolution": false,
            "shared": true,
            "value_type": "cumulative"
          },
          "type": "graph",
          "xaxis": {
            "show": true
          },
          "yaxes": [
            {
              "format": "short",
              "logBase": 1,
              "max": null,
              "min": null,
              "show": true
            },
            {
              "format": "short",
              "logBase": 1,
              "max": null,
              "min": null,
              "show": true
            }
          ]
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
          "span": 12,
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
          "title": "Panel Title",
          "transform": "table",
          "type": "table"
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
  "version": 20,
  "links": []
}`

		dashboardJson, _ := simplejson.NewJson([]byte(json))
		cmd := &SaveDashboardCommand{
			Dashboard: dashboardJson,
			UserId:    1,
			OrgId:     1,
			Overwrite: true,
		}

		alerts := *cmd.GetAlertModels()

		Convey("all properties have been set", func() {
			So(alerts, ShouldNotBeEmpty)
			So(len(alerts), ShouldEqual, 2)

			for _, v := range alerts {
				So(v.DashboardId, ShouldNotEqual, 0)
				So(v.PanelId, ShouldNotEqual, 0)

				So(v.WarnLevel, ShouldEqual, 30)
				So(v.ErrorLevel, ShouldEqual, 50)

				So(v.Aggregator, ShouldNotBeEmpty)
				//So(v.Query, ShouldNotBeEmpty)
				So(v.QueryRefId, ShouldNotBeEmpty)
				So(v.QueryRange, ShouldNotBeEmpty)
				So(v.Title, ShouldNotBeEmpty)
				So(v.Description, ShouldNotBeEmpty)

				fmt.Println(v.Query)
			}

			//So(alerts[0].Query, ShouldEqual, "statsd.fakesite.counters.session_start.desktop.count")
			//So(alerts[1].Query, ShouldEqual, "statsd.fakesite.counters.session_start.mobile.count")
		})
	})
}
