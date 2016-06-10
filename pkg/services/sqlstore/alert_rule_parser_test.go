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
		alertRuleDAO := &m.AlertRuleModel{}
		json, _ := simplejson.NewJson([]byte(`
      {
        "frequency": 10,
        "warning": {
          "op": ">",
          "level": 10
        },
        "critical": {
          "op": ">",
          "level": 20
        },
        "query": {
          "refId": "A",
          "from": "5m",
          "to": "now",
          "datasourceId": 1,
          "query": "aliasByNode(statsd.fakesite.counters.session_start.*.count, 4)"
        },
        "transform": {
          "type": "aggregation",
          "method": "avg"
        }
			}`))

		alertRuleDAO.Name = "Test"
		alertRuleDAO.Expression = json
		rule, _ := alerting.ConvetAlertModelToAlertRule(alertRuleDAO)

		Convey("Confirm that all properties are set", func() {
			So(rule.Query.Query, ShouldEqual, "aliasByNode(statsd.fakesite.counters.session_start.*.count, 4)")
			So(rule.Query.From, ShouldEqual, "5m")
			So(rule.Query.To, ShouldEqual, "now")
			So(rule.Query.DatasourceId, ShouldEqual, 1)
			So(rule.Warning.Level, ShouldEqual, 10)
			So(rule.Warning.Operator, ShouldEqual, ">")
			So(rule.Critical.Level, ShouldEqual, 20)
			So(rule.Critical.Operator, ShouldEqual, ">")
		})
	})
}
