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
				"frequency": "60s",
        "conditions": [
          {
            "type": "query",
            "query":  {
              "params": ["A", "5m", "now"],
              "datasourceId": 1,
              "query":  "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"
            },
            "reducer": {"type": "avg", "params": []},
            "evaluator": {"type": ">", "params": [100]}
          }
        ]
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

			alertRule, err := NewAlertRuleFromDBModel2(alert)
			So(err, ShouldBeNil)

			So(alertRule.Conditions, ShouldHaveLength, 1)
		})
	})
}
