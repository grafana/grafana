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
		TLSConfig:   cmd.TLSConfig,
	})
}

func (s sender) SendEmail(ctx context.Context, cmd *receivers.SendEmailSettings) error {
	sendEmailCommand := notifications.SendEmailCommand{
		To:            cmd.To,
		SingleEmail:   cmd.SingleEmail,
		Template:      cmd.Template,
		Subject:       cmd.Subject,
		Data:          cmd.Data,
		ReplyTo:       cmd.ReplyTo,
		EmbeddedFiles: cmd.EmbeddedFiles,
	}
	if len(cmd.EmbeddedContents) > 0 {
		sendEmailCommand.EmbeddedContents = make([]notifications.EmbeddedContent, len(cmd.EmbeddedContents))
		for i, ec := range cmd.EmbeddedContents {
			sendEmailCommand.EmbeddedContents[i] = notifications.EmbeddedContent{
				Name:    ec.Name,
				Content: ec.Content,
			}
		}
	}
	return s.ns.SendEmailCommandHandlerSync(ctx, &notifications.SendEmailCommandSync{
		SendEmailCommand: sendEmailCommand,
	})
}
