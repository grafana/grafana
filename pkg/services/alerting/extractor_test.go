package alerting

import (
	"io/ioutil"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertRuleExtraction(t *testing.T) {
	Convey("Parsing alert rules  from dashboard json", t, func() {
		RegisterCondition("query", func(model *simplejson.Json, index int) (Condition, error) {
			return &FakeCondition{}, nil
		})

		// mock data
		defaultDs := &models.DataSource{Id: 12, OrgId: 1, Name: "I am default", IsDefault: true}
		graphite2Ds := &models.DataSource{Id: 15, OrgId: 1, Name: "graphite2"}
		influxDBDs := &models.DataSource{Id: 16, OrgId: 1, Name: "InfluxDB"}
		prom := &models.DataSource{Id: 17, OrgId: 1, Name: "Prometheus"}

		bus.AddHandler("test", func(query *models.GetDataSourcesQuery) error {
			query.Result = []*models.DataSource{defaultDs, graphite2Ds}
			return nil
		})

		bus.AddHandler("test", func(query *models.GetDataSourceByNameQuery) error {
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

		json, err := ioutil.ReadFile("./testdata/graphite-alert.json")
		So(err, ShouldBeNil)

		Convey("Extractor should not modify the original json", func() {
			dashJSON, err := simplejson.NewJson(json)
			So(err, ShouldBeNil)

			dash := models.NewDashboardFromJson(dashJSON)

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
				So(getTarget(dashJSON), ShouldEqual, "")
			})

			extractor := NewDashAlertExtractor(dash, 1, nil)
			_, _ = extractor.GetAlerts()

			Convey("Dashboard json should not be updated after extracting rules", func() {
				So(getTarget(dashJSON), ShouldEqual, "")
			})
		})

		Convey("Parsing and validating dashboard containing graphite alerts", func() {
			dashJSON, err := simplejson.NewJson(json)
			So(err, ShouldBeNil)

			dash := models.NewDashboardFromJson(dashJSON)
			extractor := NewDashAlertExtractor(dash, 1, nil)

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

				Convey("should extract for param", func() {
					So(alerts[0].For, ShouldEqual, time.Minute*2)
					So(alerts[1].For, ShouldEqual, time.Duration(0))
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
			panelWithoutID, err := ioutil.ReadFile("./testdata/panels-missing-id.json")
			So(err, ShouldBeNil)

			dashJSON, err := simplejson.NewJson(panelWithoutID)
			So(err, ShouldBeNil)
			dash := models.NewDashboardFromJson(dashJSON)
			extractor := NewDashAlertExtractor(dash, 1, nil)

			_, err = extractor.GetAlerts()

			Convey("panels without Id should return error", func() {
				So(err, ShouldNotBeNil)
			})
		})

		Convey("Panel with id set to zero should return error", func() {
			panelWithIDZero, err := ioutil.ReadFile("./testdata/panel-with-id-0.json")
			So(err, ShouldBeNil)

			dashJSON, err := simplejson.NewJson(panelWithIDZero)
			So(err, ShouldBeNil)
			dash := models.NewDashboardFromJson(dashJSON)
			extractor := NewDashAlertExtractor(dash, 1, nil)

			_, err = extractor.GetAlerts()

			Convey("panel with id 0 should return error", func() {
				So(err, ShouldNotBeNil)
			})
		})

		Convey("Parse alerts from dashboard without rows", func() {
			json, err := ioutil.ReadFile("./testdata/v5-dashboard.json")
			So(err, ShouldBeNil)

			dashJSON, err := simplejson.NewJson(json)
			So(err, ShouldBeNil)
			dash := models.NewDashboardFromJson(dashJSON)
			extractor := NewDashAlertExtractor(dash, 1, nil)

			alerts, err := extractor.GetAlerts()

			Convey("Get rules without error", func() {
				So(err, ShouldBeNil)
			})

			Convey("Should have 2 alert rule", func() {
				So(len(alerts), ShouldEqual, 2)
			})
		})

		Convey("Alert notifications are in DB", func() {
			sqlstore.InitTestDB(t)
			firstNotification := models.CreateAlertNotificationCommand{Uid: "notifier1", OrgId: 1, Name: "1"}
			err = sqlstore.CreateAlertNotificationCommand(&firstNotification)
			So(err, ShouldBeNil)
			secondNotification := models.CreateAlertNotificationCommand{Uid: "notifier2", OrgId: 1, Name: "2"}
			err = sqlstore.CreateAlertNotificationCommand(&secondNotification)
			So(err, ShouldBeNil)

			Convey("Parse and validate dashboard containing influxdb alert", func() {
				json, err := ioutil.ReadFile("./testdata/influxdb-alert.json")
				So(err, ShouldBeNil)

				dashJSON, err := simplejson.NewJson(json)
				So(err, ShouldBeNil)
				dash := models.NewDashboardFromJson(dashJSON)
				extractor := NewDashAlertExtractor(dash, 1, nil)

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
				json, err := ioutil.ReadFile("./testdata/collapsed-panels.json")
				So(err, ShouldBeNil)

				dashJSON, err := simplejson.NewJson(json)
				So(err, ShouldBeNil)

				dash := models.NewDashboardFromJson(dashJSON)
				extractor := NewDashAlertExtractor(dash, 1, nil)

				alerts, err := extractor.GetAlerts()

				Convey("Get rules without error", func() {
					So(err, ShouldBeNil)
				})

				Convey("should be able to extract collapsed alerts", func() {
					So(len(alerts), ShouldEqual, 4)
				})
			})

			Convey("Parse and validate dashboard without id and containing an alert", func() {
				json, err := ioutil.ReadFile("./testdata/dash-without-id.json")
				So(err, ShouldBeNil)

				dashJSON, err := simplejson.NewJson(json)
				So(err, ShouldBeNil)
				dash := models.NewDashboardFromJson(dashJSON)
				extractor := NewDashAlertExtractor(dash, 1, nil)

				err = extractor.ValidateAlerts()

				Convey("Should validate without error", func() {
					So(err, ShouldBeNil)
				})

				Convey("Should fail on save", func() {
					_, err := extractor.GetAlerts()
					So(err.Error(), ShouldEqual, "alert validation error: Panel id is not correct, alertName=Influxdb, panelId=1")
				})
			})
		})
	})
}
