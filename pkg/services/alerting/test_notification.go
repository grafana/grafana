package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type NotificationTestCommand struct {
	State    m.AlertStateType
	Name     string
	Type     string
	Settings *simplejson.Json
}

func init() {
	bus.AddHandler("alerting", handleNotificationTestCommand)

}

func handleNotificationTestCommand(cmd *NotificationTestCommand) error {
	notifier := NewRootNotifier()

	model := &m.AlertNotification{
		Name:     cmd.Name,
		Type:     cmd.Type,
		Settings: cmd.Settings,
	}

	notifiers, err := notifier.createNotifierFor(model)

	if err != nil {
		log.Error2("Failed to create notifier", "error", err.Error())
		return err
	}

	notifier.sendNotifications([]Notifier{notifiers}, createTestEvalContext(cmd.State))

	return nil
}

func createTestEvalContext(state m.AlertStateType) *EvalContext {

	testRule := &Rule{
		DashboardId: 1,
		PanelId:     1,
		Name:        "Test notification",
		Message:     "Someone is testing the alert notification within grafana.",
		State:       state,
	}

	ctx := NewEvalContext(testRule)
	ctx.ImagePublicUrl = "http://grafana.org/assets/img/blog/mixed_styles.png"

	ctx.IsTestRun = true
	ctx.Firing = state == m.AlertStateAlerting
	ctx.Error = nil
	ctx.EvalMatches = evalMatchesBasedOnState(state)

	return ctx
}

func evalMatchesBasedOnState(state m.AlertStateType) []*EvalMatch {
	matches := make([]*EvalMatch, 0)
	if state == m.AlertStateOK {
		return matches
	}

	matches = append(matches, &EvalMatch{
		Metric: "High value",
		Value:  100,
	})

	matches = append(matches, &EvalMatch{
		Metric: "Higher Value",
		Value:  200,
	})

	return matches
}
