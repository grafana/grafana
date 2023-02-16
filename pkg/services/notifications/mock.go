package notifications

import (
	"context"
)

type NotificationServiceMock struct {
	Webhook     SendWebhookSync
	EmailSync   SendEmailCommandSync
	Email       SendEmailCommand
	ShouldError error

	WebhookHandler   func(context.Context, *SendWebhookSync) error
	EmailHandlerSync func(context.Context, *SendEmailCommandSync) error
	EmailHandler     func(context.Context, *SendEmailCommand) error
}

func (ns *NotificationServiceMock) SendWebhookSync(ctx context.Context, cmd *SendWebhookSync) error {
	ns.Webhook = *cmd
	if ns.WebhookHandler != nil {
		return ns.WebhookHandler(ctx, cmd)
	}
	return ns.ShouldError
}

func (ns *NotificationServiceMock) SendEmailCommandHandlerSync(ctx context.Context, cmd *SendEmailCommandSync) error {
	ns.EmailSync = *cmd
	if ns.EmailHandlerSync != nil {
		return ns.EmailHandlerSync(ctx, cmd)
	}
	return ns.ShouldError
}

func (ns *NotificationServiceMock) SendEmailCommandHandler(ctx context.Context, cmd *SendEmailCommand) error {
	ns.Email = *cmd
	if ns.EmailHandler != nil {
		return ns.EmailHandler(ctx, cmd)
	}
	return ns.ShouldError
}

func MockNotificationService() *NotificationServiceMock { return &NotificationServiceMock{} }
