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

		RegisterCondition("query", func(model *simplejson.Json, index int) (Condition, error) {
			return &FakeCondition{}, nil
		})

		Convey("Parsing and validating alerts from dashboards", func() {
			json := `{
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
              "enabled": true,
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
              "enabled": true,
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
					So(v.Message, ShouldNotBeEmpty)
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
	})
}
