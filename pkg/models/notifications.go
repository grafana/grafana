package models

import "errors"

var ErrInvalidEmailCode = errors.New("Invalid or expired email code")
var ErrSmtpNotEnabled = errors.New("SMTP not configured, check your grafana.ini config file's [smtp] section")

// SendEmailAttachFile is a definition of the attached files without path
type SendEmailAttachFile struct {
	Name    string
	Content []byte
}

// SendEmailCommand is command for sending emails
type SendEmailCommand struct {
	To            []string
	SingleEmail   bool
	Template      string
	Subject       string
	Data          map[string]interface{}
	Info          string
	ReplyTo       []string
	EmbededFiles  []string
	AttachedFiles []*SendEmailAttachFile
}

// SendEmailCommandSync is command for sending emails in sync
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
}

type SendResetPasswordEmailCommand struct {
	User *User
}

type ValidateResetPasswordCodeQuery struct {
	Code   string
	Result *User
}
