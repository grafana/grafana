package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertRuleModelParsing(t *testing.T) {

	Convey("Parsing alertRule from expression", t, func() {
		alertRuleDAO := &m.AlertRuleDAO{}
		json, _ := simplejson.NewJson([]byte(`
      {
        "critical": {
          "level": 20,
          "op": ">"
        },
        "description": "Alerting Panel Title alert",
        "evalQuery": {
          "agg": "avg",
          "from": "5m",
          "params": [
            "#A",
            "5m",
            "now",
            "avg"
          ],
          "queryRefId": "A",
          "to": "now"
        },
        "evalStringParam1": "",
        "frequency": 10,
        "function": "static",
        "name": "Alerting Panel Title alert",
        "queryRef": "- select query -",
        "valueQuery": {
          "agg": "avg",
          "datasourceId": 1,
          "from": "5m",
          "params": [
            "#A",
            "5m",
            "now",
            "avg"
          ],
          "query": "aliasByNode(statsd.fakesite.counters.session_start.*.count, 4)",
          "queryRefId": "A",
          "to": "now"
        },
        "warning": {
          "level": 10,
          "op": ">"
        }
      }`))

		alertRuleDAO.Name = "Test"
		alertRuleDAO.Expression = json
		rule, _ := alerting.ParseAlertRulesFromAlertModel(alertRuleDAO)

		Convey("Confirm that all properties are set", func() {
			So(rule.ValueQuery.Query, ShouldEqual, "aliasByNode(statsd.fakesite.counters.session_start.*.count, 4)")
			So(rule.ValueQuery.From, ShouldEqual, "5m")
			So(rule.ValueQuery.To, ShouldEqual, "now")
			So(rule.ValueQuery.DatasourceId, ShouldEqual, 1)
			So(rule.ValueQuery.Aggregator, ShouldEqual, "avg")
			So(rule.Warning.Level, ShouldEqual, 10)
			So(rule.Warning.Operator, ShouldEqual, ">")
			So(rule.Critical.Level, ShouldEqual, 20)
			So(rule.Critical.Operator, ShouldEqual, ">")
		})
	})
}
