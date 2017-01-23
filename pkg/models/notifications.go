package models

import "errors"

var ErrInvalidEmailCode = errors.New("Invalid or expired email code")

type SendEmailCommand struct {
	To           []string
	Template     string
	Subject      string
	Data         map[string]interface{}
	Info         string
	EmbededFiles []string
}

type SendEmailCommandSync struct {
	SendEmailCommand
}

type SendWebhookSync struct {
	Url        string
	User       string
	Password   string
	Body       string
	HttpMethod string
	HttpHeader map[string]string
}

type SendResetPasswordEmailCommand struct {
	User *User
}

type ValidateResetPasswordCodeQuery struct {
	Code   string
	Result *User
}
