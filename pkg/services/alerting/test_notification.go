package alerting

import (
	"context"

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

	notifier.sendNotifications(createTestEvalContext(), []Notifier{notifiers})

	return nil
}

func createTestEvalContext() *EvalContext {
	testRule := &Rule{
		DashboardId: 1,
		PanelId:     1,
		Name:        "Test notification",
		Message:     "Someone is testing the alert notification within grafana.",
		State:       m.AlertStateAlerting,
	}

	ctx := NewEvalContext(context.TODO(), testRule)
	ctx.ImagePublicUrl = "http://grafana.org/assets/img/blog/mixed_styles.png"

	ctx.IsTestRun = true
	ctx.Firing = true
	ctx.Error = nil
	ctx.EvalMatches = evalMatchesBasedOnState()

	return ctx
}

func evalMatchesBasedOnState() []*EvalMatch {
	matches := make([]*EvalMatch, 0)
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
