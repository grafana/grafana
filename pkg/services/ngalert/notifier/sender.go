package notifier

import (
	"context"

	"github.com/grafana/alerting/receivers"

	"github.com/grafana/grafana/pkg/services/notifications"
)

type sender struct {
	ns notifications.Service
}

func (s sender) SendWebhook(ctx context.Context, cmd *receivers.SendWebhookSettings) error {
	return s.ns.SendWebhookSync(ctx, &notifications.SendWebhookSync{
		Url:         cmd.URL,
		User:        cmd.User,
		Password:    cmd.Password,
		Body:        cmd.Body,
		HttpMethod:  cmd.HTTPMethod,
		HttpHeader:  cmd.HTTPHeader,
		ContentType: cmd.ContentType,
		Validation:  cmd.Validation,
	})
}

func (s sender) SendEmail(ctx context.Context, cmd *receivers.SendEmailSettings) error {
	var attached []*notifications.SendEmailAttachFile
	if cmd.AttachedFiles != nil {
		attached = make([]*notifications.SendEmailAttachFile, 0, len(cmd.AttachedFiles))
		for _, file := range cmd.AttachedFiles {
			attached = append(attached, &notifications.SendEmailAttachFile{
				Name:    file.Name,
				Content: file.Content,
			})
		}
	}
	return s.ns.SendEmailCommandHandlerSync(ctx, &notifications.SendEmailCommandSync{
		SendEmailCommand: notifications.SendEmailCommand{
			To:            cmd.To,
			SingleEmail:   cmd.SingleEmail,
			Template:      cmd.Template,
			Subject:       cmd.Subject,
			Data:          cmd.Data,
			Info:          cmd.Info,
			ReplyTo:       cmd.ReplyTo,
			EmbeddedFiles: cmd.EmbeddedFiles,
			AttachedFiles: attached,
		},
	})
}

func NewNotificationSender(ns notifications.Service) receivers.NotificationSender {
	return &sender{ns: ns}
}
