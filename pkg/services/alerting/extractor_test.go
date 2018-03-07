package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertRuleExtraction(t *testing.T) {

	Convey("Parsing alert rules  from dashboard json", t, func() {

		RegisterCondition("query", func(model *simplejson.Json, index int) (Condition, error) {
			return &FakeCondition{}, nil
		})

		setting.NewConfigContext(&setting.CommandLineArgs{
			HomePath: "../../../",
		})

		// mock data
		defaultDs := &m.DataSource{Id: 12, OrgId: 1, Name: "I am default", IsDefault: true}
		graphite2Ds := &m.DataSource{Id: 15, OrgId: 1, Name: "graphite2"}
		influxDBDs := &m.DataSource{Id: 16, OrgId: 1, Name: "InfluxDB"}

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
			if query.Name == influxDBDs.Name {
				query.Result = influxDBDs
			}
			return nil
		})

		json := `
      {
        "id": 57,
        "title": "Graphite 4",
        "originalTitle": "Graphite 4",
        "tags": ["graphite"],
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
              "message": "desc1",
              "handler": 1,
              "frequency": "60s",
              "conditions": [
              {
                "type": "query",
                "query": {"params": ["A", "5m", "now"]},
                "reducer": {"type": "avg", "params": []},
                "evaluator": {"type": ">", "params": [100]}
              }
              ]
            }
          },
          {
            "title": "Active mobile users",
            "id": 4,
            "targets": [
              {"refId": "A", "target": ""},
              {"refId": "B", "target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}
            ],
            "datasource": "graphite2",
            "alert": {
              "name": "name2",
              "message": "desc2",
              "handler": 0,
              "frequency": "60s",
              "severity": "warning",
              "conditions": [
              {
                "type": "query",
                "query":  {"params": ["B", "5m", "now"]},
                "reducer": {"type": "avg", "params": []},
                "evaluator": {"type": ">", "params": [100]}
              }
              ]
            }
          }
          ]
        }
      ]
      }`

		Convey("Extractor should not modify the original json", func() {
			dashJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			dash := m.NewDashboardFromJson(dashJson)

			getTarget := func(j *simplejson.Json) string {
				rowObj := j.Get("rows").MustArray()[0]
				row := simplejson.NewFromAny(rowObj)
				panelObj := row.Get("panels").MustArray()[0]
				panel := simplejson.NewFromAny(panelObj)
				conditionObj := panel.Get("alert").Get("conditions").MustArray()[0]
				condition := simplejson.NewFromAny(conditionObj)
				return condition.Get("query").Get("model").Get("target").MustString()
			}

			Convey("Dashboard json rows.panels.alert.query.model.target should be empty", func() {
				So(getTarget(dashJson), ShouldEqual, "")
			})

			extractor := NewDashAlertExtractor(dash, 1)
			_, _ = extractor.GetAlerts()

			Convey("Dashboard json should not be updated after extracting rules", func() {
				So(getTarget(dashJson), ShouldEqual, "")
			})
		})

		Convey("Parsing and validating dashboard containing graphite alerts", func() {

			dashJson, err := simplejson.NewJson([]byte(json))
			So(err, ShouldBeNil)

			dash := m.NewDashboardFromJson(dashJson)
			extractor := NewDashAlertExtractor(dash, 1)

			alerts, err := extractor.GetAlerts()

			Convey("Get rules without error", func() {
				So(err, ShouldBeNil)
			})

			Convey("all properties have been set", func() {
				So(len(alerts), ShouldEqual, 2)

				for _, v := range alerts {
					So(v.DashboardId, ShouldEqual, 57)
					So(v.Name, ShouldNotBeEmpty)
					So(v.Message, ShouldNotBeEmpty)

					settings := simplejson.NewFromAny(v.Settings)
					So(settings.Get("interval").MustString(""), ShouldEqual, "")
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
					So(alerts[0].Message, ShouldEqual, "desc1")
					So(alerts[1].Name, ShouldEqual, "name2")
					So(alerts[1].Message, ShouldEqual, "desc2")
				})

				Convey("should set datasourceId", func() {
					condition := simplejson.NewFromAny(alerts[0].Settings.Get("conditions").MustArray()[0])
					query := condition.Get("query")
					So(query.Get("datasourceId").MustInt64(), ShouldEqual, 12)
				})

				Convey("should copy query model to condition", func() {
					condition := simplejson.NewFromAny(alerts[0].Settings.Get("conditions").MustArray()[0])
					model := condition.Get("query").Get("model")
					So(model.Get("target").MustString(), ShouldEqual, "aliasByNode(statsd.fakesite.counters.session_start.desktop.count, 4)")
				})
			})
		})

		Convey("Parse and validate dashboard containing influxdb alert", func() {

			json2 := `{
				  "id": 4,
				  "title": "Influxdb",
				  "tags": [
				    "apa"
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
				      "height": "450px",
				      "panels": [
				        {
				          "alert": {
				            "conditions": [
				              {
				                "evaluator": {
				                  "params": [
				                    10
				                  ],
				                  "type": "gt"
				                },
				                "query": {
				                  "params": [
				                    "B",
				                    "5m",
				                    "now"
				                  ]
				                },
				                "reducer": {
				                  "params": [],
				                  "type": "avg"
				                },
				                "type": "query"
				              }
				            ],
				            "frequency": "3s",
				            "handler": 1,
				            "name": "Influxdb",
				            "noDataState": "no_data",
				            "notifications": [
				              {
				                "id": 6
				              }
				            ]
				          },
				          "alerting": {},
				          "aliasColors": {
				            "logins.count.count": "#890F02"
				          },
				          "bars": false,
				          "datasource": "InfluxDB",
				          "editable": true,
				          "error": false,
				          "fill": 1,
				          "grid": {},
				          "id": 1,
				          "interval": ">10s",
				          "isNew": true,
				          "legend": {
				            "avg": false,
				            "current": false,
				            "max": false,
				            "min": false,
				            "show": true,
				            "total": false,
				            "values": false
				          },
				          "lines": true,
				          "linewidth": 2,
				          "links": [],
				          "nullPointMode": "connected",
				          "percentage": false,
				          "pointradius": 5,
				          "points": false,
				          "renderer": "flot",
				          "seriesOverrides": [],
				          "span": 10,
				          "stack": false,
				          "steppedLine": false,
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
				              "hide": false,
				              "measurement": "logins.count",
				              "policy": "default",
				              "query": "SELECT 8 * count(\"value\") FROM \"logins.count\" WHERE $timeFilter GROUP BY time($interval), \"datacenter\" fill(none)",
				              "rawQuery": true,
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
				                    "params": [],
				                    "type": "count"
				                  }
				                ]
				              ],
				              "tags": []
				            },
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
				              "hide": true,
				              "measurement": "cpu",
				              "policy": "default",
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
				                    "params": [],
				                    "type": "mean"
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
				                    "params": [],
				                    "type": "sum"
				                  }
				                ]
				              ],
				              "tags": []
				            }
				          ],
				          "thresholds": [
				            {
				              "colorMode": "critical",
				              "fill": true,
				              "line": true,
				              "op": "gt",
				              "value": 10
				            }
				          ],
				          "timeFrom": null,
				          "timeShift": null,
				          "title": "Panel Title",
				          "tooltip": {
				            "msResolution": false,
				            "ordering": "alphabetical",
				            "shared": true,
				            "sort": 0,
				            "value_type": "cumulative"
				          },
				          "type": "graph",
				          "xaxis": {
				            "mode": "time",
				            "name": null,
				            "show": true,
				            "values": []
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
				        },
				        {
				          "editable": true,
				          "error": false,
				          "id": 2,
				          "isNew": true,
				          "limit": 10,
				          "links": [],
				          "show": "current",
				          "span": 2,
				          "stateFilter": [
				            "alerting"
				          ],
				          "title": "Alert status",
				          "type": "alertlist"
				        }
				      ],
				      "title": "Row"
				    }
				  ],
				  "time": {
				    "from": "now-5m",
				    "to": "now"
				  },
				  "timepicker": {
				    "now": true,
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
				      "1d"
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
				  "schemaVersion": 13,
				  "version": 120,
				  "links": [],
				  "gnetId": null
				}`

			dashJson, err := simplejson.NewJson([]byte(json2))
			So(err, ShouldBeNil)
			dash := m.NewDashboardFromJson(dashJson)
			extractor := NewDashAlertExtractor(dash, 1)

			alerts, err := extractor.GetAlerts()

			Convey("Get rules without error", func() {
				So(err, ShouldBeNil)
			})

			Convey("should be able to read interval", func() {
				So(len(alerts), ShouldEqual, 1)

				for _, alert := range alerts {
					So(alert.DashboardId, ShouldEqual, 4)

					conditions := alert.Settings.Get("conditions").MustArray()
					cond := simplejson.NewFromAny(conditions[0])

					So(cond.Get("query").Get("model").Get("interval").MustString(), ShouldEqual, ">10s")
				}
			})
		})
	})
}
