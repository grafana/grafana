package notifiers

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func BuildTestEvalContext() *alerting.EvalContext {
	rule := &alerting.Rule{
		Name:    "Test rule",
		Message: "Test message",
		State:   models.AlertStateAlerting,
	}

	evalMatch := &alerting.EvalMatch{
		Value:  null.FloatFrom(100.0),
		Metric: "A metric",
	}
	evalMatches := make([]*alerting.EvalMatch, 0)
	evalMatches = append(evalMatches, evalMatch)

	return &alerting.EvalContext{
		StartTime:      time.Now(),
		Rule:           rule,
		PrevAlertState: rule.State,
		EvalMatches:    evalMatches,
	}
}

func BuildFlowdockNotifier(json string) (alerting.Notifier, error) {
	settingsJSON, _ := simplejson.NewJson([]byte(json))
	model := &models.AlertNotification{
		Name:     "flowdock_testing",
		Type:     "flowdock",
		Settings: settingsJSON,
	}
	return NewFlowdockNotifier(model)
}

func TestFlowdockNotifier(t *testing.T) {
	Convey("Flowdock notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				_, err := BuildFlowdockNotifier(json)
				So(err, ShouldNotBeNil)
			})

			Convey("settings with flowToken should return notifier", func() {
				json := `
			{ "flowToken": "abcd1234" }
				`

				not, err := BuildFlowdockNotifier(json)
				flowdockNotifier := not.(*FlowdockNotifier)

				So(err, ShouldBeNil)
				So(flowdockNotifier.FlowToken, ShouldEqual, "abcd1234")
			})
		})

		Convey("Building message body", func() {
			Convey("AlertStateAlerting should result alerting status", func() {
				json := `
			{ "flowToken": "abcd1234" }
				`
				not, _ := BuildFlowdockNotifier(json)
				flowdockNotifier := not.(*FlowdockNotifier)

				testEvalContext := BuildTestEvalContext()
				testEvalContext.Rule.State = models.AlertStateAlerting
				status := flowdockNotifier.getBody(testEvalContext)["status"]
				statusMap := status.(map[string]string)
				So(statusMap["color"], ShouldEqual, "red")
				So(statusMap["value"], ShouldEqual, "Alerting")
			})

			Convey("AlertStateOK should result Ok status", func() {
				json := `
			{ "flowToken": "abcd1234" }
				`
				not, _ := BuildFlowdockNotifier(json)
				flowdockNotifier := not.(*FlowdockNotifier)

				testEvalContext := BuildTestEvalContext()
				testEvalContext.Rule.State = models.AlertStateOK
				status := flowdockNotifier.getBody(testEvalContext)["status"]
				statusMap := status.(map[string]string)
				So(statusMap["color"], ShouldEqual, "green")
				So(statusMap["value"], ShouldEqual, "Ok")
			})

			Convey("AlertStateNoData should result No data status", func() {
				json := `
			{ "flowToken": "abcd1234" }
				`
				not, _ := BuildFlowdockNotifier(json)
				flowdockNotifier := not.(*FlowdockNotifier)

				testEvalContext := BuildTestEvalContext()
				testEvalContext.Rule.State = models.AlertStateNoData
				status := flowdockNotifier.getBody(testEvalContext)["status"]
				statusMap := status.(map[string]string)
				So(statusMap["color"], ShouldEqual, "yellow")
				So(statusMap["value"], ShouldEqual, "No data")
			})
		})
	})
}
