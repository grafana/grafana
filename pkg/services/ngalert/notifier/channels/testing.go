package channels

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

// mockTimeNow replaces function timeNow to return constant time.
// It returns a function that resets the variable back to its original value.
// This allows usage of this function with defer:
// func Test (t *testing.T) {
//    now := time.Now()
//    defer mockTimeNow(now)()
//    ...
// }
func mockTimeNow(constTime time.Time) func() {
	timeNow = func() time.Time {
		return constTime
	}
	return resetTimeNow
}

// resetTimeNow resets the global variable timeNow to the default value, which is time.Now
func resetTimeNow() {
	timeNow = time.Now
}

type notificationServiceMock struct {
	webhookSender func(ctx context.Context, cmd *models.SendWebhookSync) error
	emailSender   func(ctx context.Context, cmd *models.SendEmailCommandSync) error
	webhook       models.SendWebhookSync
}

func (ns *notificationServiceMock) SendWebhookSync(ctx context.Context, cmd *models.SendWebhookSync) error {
	if ns.webhookSender != nil {
		return ns.webhookSender(ctx, cmd)
	}
	return nil
}
func (ns *notificationServiceMock) SendEmailCommandHandlerSync(ctx context.Context, cmd *models.SendEmailCommandSync) error {
	if ns.emailSender != nil {
		return ns.emailSender(ctx, cmd)
	}
	return nil
}

func mockWebhookSender() *notificationServiceMock {
	ns := &notificationServiceMock{}
	ns.webhookSender = func(c context.Context, m *models.SendWebhookSync) error {
		ns.webhook = *m
		return nil
	}
	return ns
}

func (ns *notificationServiceMock) Body() string                    { return ns.webhook.Body }
func (ns *notificationServiceMock) Webhook() models.SendWebhookSync { return ns.webhook }
