package notifications

import (
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type SendEmailCommand struct {
	To      []string
	From    string
	Subject string
	Body    string
	Type    string
	Massive bool
	Info    string
}

type SendResetPasswordEmailCommand struct {
	Email string
}

// create mail content
func (m *SendEmailCommand) Content() string {
	// set mail type
	contentType := "text/plain; charset=UTF-8"
	if m.Type == "html" {
		contentType = "text/html; charset=UTF-8"
	}

	// create mail content
	content := "From: " + m.From + "\r\nSubject: " + m.Subject + "\r\nContent-Type: " + contentType + "\r\n\r\n" + m.Body
	return content
}

// Create html mail command
func NewSendEmailCommand(To []string, From, Subject, Body string) SendEmailCommand {
	return SendEmailCommand{
		To:      To,
		From:    From,
		Subject: Subject,
		Body:    Body,
		Type:    "html",
	}
}

// Create New mail message use MailFrom and MailUser
func NewMailMessageFrom(To []string, from, subject, body string) SendEmailCommand {
	return NewSendEmailCommand(To, from, subject, body)
}

// Create New mail message use MailFrom and MailUser
func NewMailMessage(To string, subject, body string) SendEmailCommand {
	return NewMailMessageFrom([]string{To}, setting.Smtp.FromAddress, subject, body)
}

func GetMailTmplData(u *m.User) map[interface{}]interface{} {
	data := make(map[interface{}]interface{}, 10)
	data["AppUrl"] = setting.AppUrl
	data["BuildVersion"] = setting.BuildVersion
	data["BuildStamp"] = setting.BuildStamp
	data["BuildCommit"] = setting.BuildCommit
	if u != nil {
		data["User"] = u
	}
	return data
}
