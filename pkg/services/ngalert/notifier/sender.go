package notifier

import (
	"context"
	"strings"

	"github.com/grafana/alerting/receivers"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/notifications"
)

const (
	// placeholderEmailAddress is the default placeholder email address used when no real email is configured
	placeholderEmailAddress = "<example@email.com>"
)

var logger = log.New("ngalert.notifier.sender")

type emailSender struct {
	ns notifications.Service
}

// isPlaceholderEmail checks if the given email address is a placeholder that should not be sent
func isPlaceholderEmail(email string) bool {
	trimmed := strings.TrimSpace(email)
	return trimmed == placeholderEmailAddress
}

func (s emailSender) SendEmail(ctx context.Context, cmd *receivers.SendEmailSettings) error {
	// Filter out placeholder addresses from the recipient list (single loop)
	validRecipients := make([]string, 0, len(cmd.To))
	for _, addr := range cmd.To {
		if !isPlaceholderEmail(addr) {
			validRecipients = append(validRecipients, addr)
		} else {
			logger.Warn("Filtering out placeholder email address from recipients", "address", addr)
		}
	}

	// If no valid recipients remain, skip sending
	if len(validRecipients) == 0 {
		if len(cmd.To) > 0 {
			logger.Info("Skipping email notification to placeholder address(es). Please configure a valid email address in your contact point to receive alerts.", "addresses", cmd.To)
		}
		return nil
	}

	sendEmailCommand := notifications.SendEmailCommand{
		To:            validRecipients,
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
