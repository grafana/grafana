package alerting

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertRuleModel(t *testing.T) {
	Convey("Testing alert rule", t, func() {

		Convey("Can parse seconds", func() {
			seconds := getTimeDurationStringToSeconds("10s")
			So(seconds, ShouldEqual, 10)
		})

		Convey("Can parse minutes", func() {
			seconds := getTimeDurationStringToSeconds("10m")
			So(seconds, ShouldEqual, 600)
		})

		Convey("Can parse hours", func() {
			seconds := getTimeDurationStringToSeconds("1h")
			So(seconds, ShouldEqual, 3600)
		})

		Convey("defaults to seconds", func() {
			seconds := getTimeDurationStringToSeconds("1o")
			So(seconds, ShouldEqual, 1)
		})

		Convey("", func() {
			json := `
			{
				"name": "name2",
				"description": "desc2",
				"handler": 0,
				"enabled": true,
				"crit": {
					"value": 20,
					"op": ">"
				},
				"warn": {
					"value": 10,
					"op": ">"
				},
				"frequency": "60s",
				"query": {
					"from": "5m",
					"refId": "A",
					"to": "now",
					"query": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)",
					"datasourceId": 1
				},
				"transform": {
					"type": "avg",
					"name": "aggregation"
				}
			}
			`

			alertJSON, jsonErr := simplejson.NewJson([]byte(json))
			So(jsonErr, ShouldBeNil)

			alert := &models.Alert{
				Id:          1,
				OrgId:       1,
				DashboardId: 1,
				PanelId:     1,

				Settings: alertJSON,
			}
			alertRule, err := NewAlertRuleFromDBModel(alert)

			So(err, ShouldBeNil)

			So(alertRule.Warning.Operator, ShouldEqual, ">")
			So(alertRule.Warning.Value, ShouldEqual, 10)

			So(alertRule.Critical.Operator, ShouldEqual, ">")
			So(alertRule.Critical.Value, ShouldEqual, 20)
		})
	})
}
