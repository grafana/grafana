package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/components/securejsondata"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

// NotificationTestCommand initiates an test
// execution of an alert notification.
type NotificationTestCommand struct {
	OrgID          int64
	ID             int64
	State          models.AlertStateType
	Name           string
	Type           string
	Settings       *simplejson.Json
	SecureSettings map[string]string
}

var (
	logger = log.New("alerting.testnotification")
)

func init() {
	bus.AddHandler("alerting", handleNotificationTestCommand)
}

func handleNotificationTestCommand(cmd *NotificationTestCommand) error {
	notifier := newNotificationService(nil)

	model := &models.AlertNotification{
		Name:     cmd.Name,
		Type:     cmd.Type,
		Settings: cmd.Settings,
	}

	secureSettingsMap := map[string]string{}

	if cmd.ID > 0 {
		query := &models.GetAlertNotificationsQuery{
			OrgId: cmd.OrgID,
			Id:    cmd.ID,
		}
		if err := bus.Dispatch(query); err != nil {
			return err
		}

		if query.Result.SecureSettings != nil {
			secureSettingsMap = query.Result.SecureSettings.Decrypt()
		}
	}

	for k, v := range cmd.SecureSettings {
		secureSettingsMap[k] = v
	}

	model.SecureSettings = securejsondata.GetEncryptedJsonData(secureSettingsMap)

	notifiers, err := InitNotifier(model)

	if err != nil {
		logger.Error("Failed to create notifier", "error", err.Error())
		return err
	}

	return notifier.sendNotifications(createTestEvalContext(cmd), notifierStateSlice{{notifier: notifiers}})
}

func createTestEvalContext(cmd *NotificationTestCommand) *EvalContext {
	testRule := &Rule{
		DashboardID: 1,
		PanelID:     1,
		Name:        "Test notification",
		Message:     "Someone is testing the alert notification within Grafana.",
		State:       models.AlertStateAlerting,
	}

	ctx := NewEvalContext(context.Background(), testRule)
	if cmd.Settings.Get("uploadImage").MustBool(true) {
		ctx.ImagePublicURL = "https://grafana.com/assets/img/blog/mixed_styles.png"
	}
	ctx.IsTestRun = true
	ctx.Firing = true
	ctx.Error = fmt.Errorf("This is only a test")
	ctx.EvalMatches = evalMatchesBasedOnState()

	return ctx
}

func evalMatchesBasedOnState() []*EvalMatch {
	matches := make([]*EvalMatch, 0)
	matches = append(matches, &EvalMatch{
		Metric: "High value",
		Value:  null.FloatFrom(100),
	})

	matches = append(matches, &EvalMatch{
		Metric: "Higher Value",
		Value:  null.FloatFrom(200),
	})

	return matches
}
