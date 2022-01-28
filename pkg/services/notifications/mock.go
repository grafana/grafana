package notifications

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type NotificationServiceMock struct {
	Webhook     models.SendWebhookSync
	Email       models.SendEmailCommandSync
	ShouldError error

	WebhookHandler func(context.Context, *models.SendWebhookSync) error
	EmailHandler   func(context.Context, *models.SendEmailCommandSync) error
}

func (ns *NotificationServiceMock) SendWebhookSync(ctx context.Context, cmd *models.SendWebhookSync) error {
	ns.Webhook = *cmd
	if ns.WebhookHandler != nil {
		return ns.WebhookHandler(ctx, cmd)
	}
	return ns.ShouldError
}
func (ns *NotificationServiceMock) SendEmailCommandHandlerSync(ctx context.Context, cmd *models.SendEmailCommandSync) error {
	ns.Email = *cmd
	if ns.EmailHandler != nil {
		return ns.EmailHandler(ctx, cmd)
	}
	return ns.ShouldError
}

func MockNotificationService() *NotificationServiceMock { return &NotificationServiceMock{} }
