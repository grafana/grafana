package alerting

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
)

var (
	alertingNotificationTimeout = 100 * time.Millisecond
	sentNotificationCount       = 0
)

type fakeNotifier struct{}

func (f fakeNotifier) Notify(evalContext *EvalContext) error {
	sentNotificationCount++
	return nil
}

func (f fakeNotifier) GetType() string {
	return "ImageTimeout"
}
func (f fakeNotifier) NeedsImage() bool {
	return true
}

// ShouldNotify checks this evaluation should send an alert notification
func (f fakeNotifier) ShouldNotify(ctx context.Context, evalContext *EvalContext, notificationState *models.AlertNotificationState) bool {
	return true
}

func (f fakeNotifier) GetNotifierUID() string {
	return "1"
}
func (f fakeNotifier) GetIsDefault() bool {
	return false
}
func (f fakeNotifier) GetSendReminder() bool {
	return false
}
func (f fakeNotifier) GetDisableResolveMessage() bool {
	return true
}
func (f fakeNotifier) GetFrequency() time.Duration {
	return time.Second
}

type timeoutRenderService struct{}

func (frs timeoutRenderService) Render(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error) {
	time.Sleep(alertingNotificationTimeout) // Make sure to consume all the time while rendering
	_ = ctx.Err()
	return nil, fmt.Errorf("can't render: %v", ctx.Err())
}

func TestImgRenderTimeout(t *testing.T) {
	// I don't know what the handler names are for?
	bus.AddHandler("test1", func(query *models.GetAlertNotificationsWithUidToSendQuery) error {
		query.Result = []*models.AlertNotification{
			{
				Name:  "TimeoutTest",
				Type:  "ImageTimeout",
				Id:    1,
				OrgId: 1,
			},
		}
		return nil
	})

	bus.AddHandlerCtx("test2", func(c context.Context, query *models.GetOrCreateNotificationStateQuery) error {
		query.Result = &models.AlertNotificationState{
			Id:                           1,
			OrgId:                        1,
			AlertId:                      1,
			NotifierId:                   1,
			State:                        models.AlertNotificationStatePending,
			Version:                      1,
			UpdatedAt:                    1,
			AlertRuleStateUpdatedVersion: 1,
		}
		return nil
	})

	notifier := newNotificationService(timeoutRenderService{})

	RegisterNotifier(&NotifierPlugin{
		Name: "TimeOutTest",
		Type: "ImageTimeout",
		Factory: func(notification *models.AlertNotification) (Notifier, error) {
			return fakeNotifier{}, nil
		},
	})

	testContext, testContextCancel := context.WithTimeout(context.Background(), alertingNotificationTimeout)
	defer testContextCancel()
	evalContext := &EvalContext{
		Firing:       true,
		IsTestRun:    true,
		dashboardRef: &models.DashboardRef{},
		Rule: &Rule{
			OrgID:         1,
			Notifications: []string{"test"},
		},
		Ctx: testContext,
	}

	err := notifier.SendIfNeeded(evalContext)

	assert.Nil(t, err)
	assert.Equal(t, sentNotificationCount, 1)

}
