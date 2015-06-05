package models

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
	User *User
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
