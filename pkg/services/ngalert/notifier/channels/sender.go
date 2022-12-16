package channels

import "context"

type SendWebhookSettings struct {
	Url         string
	User        string
	Password    string
	Body        string
	HttpMethod  string
	HttpHeader  map[string]string
	ContentType string
	Validation  func(body []byte, statusCode int) error
}

// SendEmailSettings is the command for sending emails
type SendEmailSettings struct {
	To            []string
	SingleEmail   bool
	Template      string
	Subject       string
	Data          map[string]interface{}
	Info          string
	ReplyTo       []string
	EmbeddedFiles []string
	AttachedFiles []*SendEmailAttachFile
}

// SendEmailAttachFile is a definition of the attached files without path
type SendEmailAttachFile struct {
	Name    string
	Content []byte
}

type WebhookSender interface {
	SendWebhook(ctx context.Context, cmd *SendWebhookSettings) error
}

type EmailSender interface {
	SendEmail(ctx context.Context, cmd *SendEmailSettings) error
}

type NotificationSender interface {
	WebhookSender
	EmailSender
}
