package notifiers

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func BuildTestEvalContext() *alerting.EvalContext {
	rule := &alerting.Rule{
		Name:    "Test rule",
		Message: "Test message",
		State:   m.AlertStateAlerting,
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
	model := &m.AlertNotification{
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
			Convey("Foo", func() {
				json := `
			{ "flowToken": "abcd1234" }
				`
				not, _ := BuildFlowdockNotifier(json)
				flowdockNotifier := not.(*FlowdockNotifier)

				testEvalContext := BuildTestEvalContext()
				body := flowdockNotifier.getBody(testEvalContext)
				So(body["event"], ShouldEqual, "activity")
			})
		})
	})
}
