package notifications

import (
	m "github.com/Cepave/grafana/pkg/models"
	"github.com/Cepave/grafana/pkg/setting"
)

type Message struct {
	To      []string
	From    string
	Subject string
	Body    string
	Massive bool
	Info    string
}

// create mail content
func (m *Message) Content() string {
	contentType := "text/html; charset=UTF-8"
	content := "From: " + m.From + "\r\nSubject: " + m.Subject + "\r\nContent-Type: " + contentType + "\r\n\r\n" + m.Body
	return content
}

func setDefaultTemplateData(data map[string]interface{}, u *m.User) {
	data["AppUrl"] = setting.AppUrl
	data["BuildVersion"] = setting.BuildVersion
	data["BuildStamp"] = setting.BuildStamp
	data["EmailCodeValidHours"] = setting.EmailCodeValidMinutes / 60
	data["Subject"] = map[string]interface{}{}
	if u != nil {
		data["Name"] = u.NameOrFallback()
	}
}
