package notifications

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type NotificationServiceMock struct {
	Webhook     models.SendWebhookSync
	EmailSync   models.SendEmailCommandSync
	Email       models.SendEmailCommand
	ShouldError error

	WebhookHandler   func(context.Context, *models.SendWebhookSync) error
	EmailHandlerSync func(context.Context, *models.SendEmailCommandSync) error
	EmailHandler     func(context.Context, *models.SendEmailCommand) error
}

func (ns *NotificationServiceMock) SendWebhookSync(ctx context.Context, cmd *models.SendWebhookSync) error {
	ns.Webhook = *cmd
	if ns.WebhookHandler != nil {
		return ns.WebhookHandler(ctx, cmd)
	}
	return ns.ShouldError
}

func (ns *NotificationServiceMock) SendEmailCommandHandlerSync(ctx context.Context, cmd *models.SendEmailCommandSync) error {
	ns.EmailSync = *cmd
	if ns.EmailHandlerSync != nil {
		return ns.EmailHandlerSync(ctx, cmd)
	}
	return ns.ShouldError
}

func (ns *NotificationServiceMock) SendEmailCommandHandler(ctx context.Context, cmd *models.SendEmailCommand) error {
	ns.Email = *cmd
	if ns.EmailHandler != nil {
		return ns.EmailHandler(ctx, cmd)
	}
	return ns.ShouldError
}

func MockNotificationService() *NotificationServiceMock { return &NotificationServiceMock{} }
