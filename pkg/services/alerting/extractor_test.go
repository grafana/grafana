package alerting

import (
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertRuleExtraction(t *testing.T) {

	Convey("Parsing alert rules  from dashboard json", t, func() {

		RegisterCondition("query", func(model *simplejson.Json, index int) (Condition, error) {
			return &FakeCondition{}, nil
		})

		// mock data
		defaultDs := &m.DataSource{Id: 12, OrgId: 1, Name: "I am default", IsDefault: true}
		graphite2Ds := &m.DataSource{Id: 15, OrgId: 1, Name: "graphite2"}
		influxDBDs := &m.DataSource{Id: 16, OrgId: 1, Name: "InfluxDB"}
		prom := &m.DataSource{Id: 17, OrgId: 1, Name: "Prometheus"}

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
			if query.Name == prom.Name {
				query.Result = prom
			}

			return nil
		})

		json, err := ioutil.ReadFile("./test-data/graphite-alert.json")
		So(err, ShouldBeNil)

		Convey("Extractor should not modify the original json", func() {
			dashJson, err := simplejson.NewJson(json)
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

			dashJson, err := simplejson.NewJson(json)
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

		Convey("Panels missing id should return error", func() {
			panelWithoutId, err := ioutil.ReadFile("./test-data/panels-missing-id.json")
			So(err, ShouldBeNil)

			dashJson, err := simplejson.NewJson(panelWithoutId)
			So(err, ShouldBeNil)
			dash := m.NewDashboardFromJson(dashJson)
			extractor := NewDashAlertExtractor(dash, 1)

			_, err = extractor.GetAlerts()

			Convey("panels without Id should return error", func() {
				So(err, ShouldNotBeNil)
			})
		})

		Convey("Panel with id set to zero should return error", func() {
			panelWithIdZero, err := ioutil.ReadFile("./test-data/panel-with-id-0.json")
			So(err, ShouldBeNil)

			dashJson, err := simplejson.NewJson(panelWithIdZero)
			So(err, ShouldBeNil)
			dash := m.NewDashboardFromJson(dashJson)
			extractor := NewDashAlertExtractor(dash, 1)

			_, err = extractor.GetAlerts()

			Convey("panel with id 0 should return error", func() {
				So(err, ShouldNotBeNil)
			})
		})

		Convey("Parse alerts from dashboard without rows", func() {
			json, err := ioutil.ReadFile("./test-data/v5-dashboard.json")
			So(err, ShouldBeNil)

			dashJson, err := simplejson.NewJson(json)
			So(err, ShouldBeNil)
			dash := m.NewDashboardFromJson(dashJson)
			extractor := NewDashAlertExtractor(dash, 1)

			alerts, err := extractor.GetAlerts()

			Convey("Get rules without error", func() {
				So(err, ShouldBeNil)
			})

			Convey("Should have 2 alert rule", func() {
				So(len(alerts), ShouldEqual, 2)
			})
		})

		Convey("Parse and validate dashboard containing influxdb alert", func() {
			json, err := ioutil.ReadFile("./test-data/influxdb-alert.json")
			So(err, ShouldBeNil)

			dashJson, err := simplejson.NewJson(json)
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

		Convey("Should be able to extract collapsed panels", func() {
			json, err := ioutil.ReadFile("./test-data/collapsed-panels.json")
			So(err, ShouldBeNil)

			dashJson, err := simplejson.NewJson(json)
			So(err, ShouldBeNil)

			dash := m.NewDashboardFromJson(dashJson)
			extractor := NewDashAlertExtractor(dash, 1)

			alerts, err := extractor.GetAlerts()

			Convey("Get rules without error", func() {
				So(err, ShouldBeNil)
			})

			Convey("should be able to extract collapsed alerts", func() {
				So(len(alerts), ShouldEqual, 4)
			})
		})

		Convey("Parse and validate dashboard without id and containing an alert", func() {
			json, err := ioutil.ReadFile("./test-data/dash-without-id.json")
			So(err, ShouldBeNil)

			dashJSON, err := simplejson.NewJson(json)
			So(err, ShouldBeNil)
			dash := m.NewDashboardFromJson(dashJSON)
			extractor := NewDashAlertExtractor(dash, 1)

			err = extractor.ValidateAlerts()

			Convey("Should validate without error", func() {
				So(err, ShouldBeNil)
			})

			Convey("Should fail on save", func() {
				_, err := extractor.GetAlerts()
				So(err.Error(), ShouldEqual, "Alert validation error: Panel id is not correct, alertName=Influxdb, panelId=1")
			})
		})
	})
}
