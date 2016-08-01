package notifiers

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier("slack", NewSlackNotifier)
}

func NewSlackNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &SlackNotifier{
		NotifierBase: NotifierBase{
			Name: model.Name,
			Type: model.Type,
		},
		Url: url,
		log: log.New("alerting.notifier.slack"),
	}, nil
}

type SlackNotifier struct {
	NotifierBase
	Url string
	log log.Logger
}

func (this *SlackNotifier) Notify(context *alerting.EvalContext) {
	this.log.Info("Executing slack notification", "ruleId", context.Rule.Id, "notification", this.Name)

	ruleUrl, err := context.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return
	}

	fields := make([]map[string]interface{}, 0)
	fieldLimitCount := 4
	for index, evt := range context.Events {
		fields = append(fields, map[string]interface{}{
			"title": evt.Metric,
			"value": evt.Value,
			"short": true,
		})
		if index > fieldLimitCount {
			break
		}
	}

	body := map[string]interface{}{
		"attachments": []map[string]interface{}{
			map[string]interface{}{
				"color": context.GetColor(),
				//"pretext":     "Optional text that appears above the attachment block",
				// "author_name": "Bobby Tables",
				// "author_link": "http://flickr.com/bobby/",
				// "author_icon": "http://flickr.com/icons/bobby.jpg",
				"title":      context.GetNotificationTitle(),
				"title_link": ruleUrl,
				// "text":       "Optional text that appears within the attachment",
				"fields":    fields,
				"image_url": context.ImagePublicUrl,
				// "thumb_url":   "http://example.com/path/to/thumb.png",
				"footer":      "Grafana v4.0.0",
				"footer_icon": "http://grafana.org/assets/img/fav32.png",
				"ts":          time.Now().Unix(),
			},
		},
	}

	data, _ := json.Marshal(&body)
	cmd := &m.SendWebhook{Url: this.Url, Body: string(data)}

	if err := bus.Dispatch(cmd); err != nil {
		this.log.Error("Failed to send slack notification", "error", err, "webhook", this.Name)
	}
}
