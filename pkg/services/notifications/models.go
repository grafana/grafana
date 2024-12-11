package notifications

import (
	"crypto/tls"
	"errors"

	"github.com/grafana/grafana/pkg/services/user"
)

var ErrInvalidEmailCode = errors.New("invalid or expired email code")
var ErrSmtpNotEnabled = errors.New("SMTP not configured, check your grafana.ini config file's [smtp] section")

// SendEmailAttachFile is a definition of the attached files without path
type SendEmailAttachFile struct {
	Name    string
	Content []byte
}

// SendEmailCommand is the command for sending emails
type SendEmailCommand struct {
	To            []string
	SingleEmail   bool
	Template      string
	Subject       string
	Data          map[string]any
	Info          string
	ReplyTo       []string
	EmbeddedFiles []string
	AttachedFiles []*SendEmailAttachFile
}

// SendEmailCommandSync is the command for sending emails synchronously
type SendEmailCommandSync struct {
	SendEmailCommand
}

type SendWebhookSync struct {
	Url         string
	User        string
	Password    string
	Body        string
	HttpMethod  string
	HttpHeader  map[string]string
	ContentType string
	Validation  func(body []byte, statusCode int) error
	TLSConfig   *tls.Config
}

type SendResetPasswordEmailCommand struct {
	User *user.User
}

type ValidateResetPasswordCodeQuery struct {
	Code string
}

type SendVerifyEmailCommand struct {
	User  *user.User
	Code  string
	Email string
}
