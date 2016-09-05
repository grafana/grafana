package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
)

type NotificationTestCommand struct {
	Severity string
	Name     string
	Type     string
	Settings *simplejson.Json
}

func init() {
	bus.AddHandler("alerting", handleNotificationTestCommand)

}

func handleNotificationTestCommand(cmd *NotificationTestCommand) error {
	notifier := NewRootNotifier()

	model := &models.AlertNotification{
		Name:     cmd.Name,
		Type:     cmd.Type,
		Settings: cmd.Settings,
	}

	notifiers, err := notifier.getNotifierFor(model)

	if err != nil {
		log.Error2("Failed to create notifier", "error", err.Error())
		return err
	}

	severity := models.AlertSeverityType(cmd.Severity)
	notifier.sendNotifications([]Notifier{notifiers}, createTestEvalContext(severity))

	return nil
}

func createTestEvalContext(severity models.AlertSeverityType) *EvalContext {
	state := models.AlertStateOK
	firing := false
	if severity == models.AlertSeverityCritical {
		state = models.AlertStateCritical
		firing = true
	}
	if severity == models.AlertSeverityWarning {
		state = models.AlertStateWarning
		firing = true
	}

	testRule := &Rule{
		DashboardId: 1,
		PanelId:     1,
		Name:        "Test notification",
		Message:     "Someone is testing the alert notification within grafana.",
		State:       state,
		Severity:    severity,
	}

	ctx := NewEvalContext(testRule)
	ctx.ImagePublicUrl = "http://grafana.org/assets/img/blog/mixed_styles.png"

	ctx.IsTestRun = true
	ctx.Firing = firing
	ctx.Error = nil
	ctx.EvalMatches = evalMatchesBasedOnSeverity(severity)

	return ctx
}

func evalMatchesBasedOnSeverity(severity models.AlertSeverityType) []*EvalMatch {
	matches := make([]*EvalMatch, 0)
	if severity == models.AlertSeverityOK {
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
