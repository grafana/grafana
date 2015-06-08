package notifications

import (
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// Create New mail message use MailFrom and MailUser
func newMailMessageFrom(To []string, from, subject, body string) m.SendEmailCommand {
	return m.NewSendEmailCommand(To, from, subject, body)
}

// Create New mail message use MailFrom and MailUser
func newMailMessage(To string, subject, body string) m.SendEmailCommand {
	return newMailMessageFrom([]string{To}, setting.Smtp.FromAddress, subject, body)
}

func getMailTmplData(u *m.User) map[interface{}]interface{} {
	data := make(map[interface{}]interface{}, 10)
	data["AppUrl"] = setting.AppUrl
	data["BuildVersion"] = setting.BuildVersion
	data["BuildStamp"] = setting.BuildStamp
	data["EmailCodeValidHours"] = setting.EmailCodeValidMinutes / 60
	data["Subject"] = map[string]interface{}{}
	if u != nil {
		data["Name"] = u.NameOrFallback()
	}
	return data
}
