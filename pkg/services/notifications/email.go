package notifications

import (
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// AttachedFile struct represents email attached files.
type AttachedFile struct {
	Name    string
	Content []byte
}

// Message is representation of the email message.
type Message struct {
	To            []string
	SingleEmail   bool
	From          string
	Subject       string
	Body          map[string]string
	Info          string
	ReplyTo       []string
	EmbeddedFiles []string
	AttachedFiles []*AttachedFile
}

func setDefaultTemplateData(cfg *setting.Cfg, data map[string]interface{}, u *user.User) {
	data["AppUrl"] = setting.AppUrl
	data["BuildVersion"] = setting.BuildVersion
	data["BuildStamp"] = setting.BuildStamp
	data["EmailCodeValidHours"] = cfg.EmailCodeValidMinutes / 60
	data["Subject"] = map[string]interface{}{}
	if u != nil {
		data["Name"] = u.NameOrFallback()
	}
	dataCopy := map[string]interface{}{}
	for k, v := range data {
		dataCopy[k] = v
	}
	data["TemplateData"] = dataCopy
}
