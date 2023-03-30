package alerting

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
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

func (s *AlertNotificationService) HandleNotificationTestCommand(ctx context.Context, cmd *NotificationTestCommand) error {
	notificationSvc := newNotificationService(nil, nil, nil, nil)

	model := models.AlertNotification{
		ID:       cmd.ID,
		OrgID:    cmd.OrgID,
		Name:     cmd.Name,
		Type:     cmd.Type,
		Settings: cmd.Settings,
	}

	notifier, err := s.createNotifier(ctx, &model, cmd.SecureSettings)
	if err != nil {
		return err
	}

	return notificationSvc.sendNotifications(createTestEvalContext(cmd), notifierStateSlice{{notifier: notifier}})
}

func createTestEvalContext(cmd *NotificationTestCommand) *EvalContext {
	testRule := &Rule{
		DashboardID: 1,
		PanelID:     1,
		Name:        "Test notification",
		Message:     "Someone is testing the alert notification within Grafana.",
		State:       models.AlertStateAlerting,
		ID:          rand.Int63(),
	}

	ctx := NewEvalContext(context.Background(), testRule, fakeRequestValidator{}, nil, nil, nil, annotationstest.NewFakeAnnotationsRepo())
	if cmd.Settings.Get("uploadImage").MustBool(true) {
		ctx.ImagePublicURL = "https://grafana.com/static/assets/img/blog/mixed_styles.png"
	}
	ctx.IsTestRun = true
	ctx.Firing = true
	ctx.Error = fmt.Errorf("this is only a test")
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

type fakeRequestValidator struct{}

func (fakeRequestValidator) Validate(_ string, _ *http.Request) error {
	return nil
}
