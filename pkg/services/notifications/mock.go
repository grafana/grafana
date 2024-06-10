package notifications

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type NotificationServiceMock struct {
	Webhook           SendWebhookSync
	EmailSync         SendEmailCommandSync
	Email             SendEmailCommand
	EmailVerified     bool
	EmailVerification SendVerifyEmailCommand
	ShouldError       error

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

func (ns *NotificationServiceMock) SendResetPasswordEmail(ctx context.Context, cmd *SendResetPasswordEmailCommand) error {
	// TODO: Implement if needed
	return ns.ShouldError
}

func (ns *NotificationServiceMock) ValidateResetPasswordCode(ctx context.Context, query *ValidateResetPasswordCodeQuery, userByLogin GetUserByLoginFunc) (*user.User, error) {
	// TODO: Implement if needed
	return nil, ns.ShouldError
}

func (ns *NotificationServiceMock) SendVerificationEmail(ctx context.Context, cmd *SendVerifyEmailCommand) error {
	ns.EmailVerified = true
	ns.EmailVerification = *cmd
	return ns.ShouldError
}

func MockNotificationService() *NotificationServiceMock { return &NotificationServiceMock{} }
