package notifiers

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
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
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Url:          url,
		log:          log.New("alerting.notifier.slack"),
	}, nil
}

type SlackNotifier struct {
	NotifierBase
	Url string
	log log.Logger
}

func (this *SlackNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing slack notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)
	metrics.M_Alerting_Notification_Sent_Slack.Inc(1)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	fields := make([]map[string]interface{}, 0)
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		fields = append(fields, map[string]interface{}{
			"title": evt.Metric,
			"value": evt.Value,
			"short": true,
		})
		if index > fieldLimitCount {
			break
		}
	}

	if evalContext.Error != nil {
		fields = append(fields, map[string]interface{}{
			"title": "Error message",
			"value": evalContext.Error.Error(),
			"short": false,
		})
	}

	message := ""
	if evalContext.Rule.State != m.AlertStateOK { //dont add message when going back to alert state ok.
		message = evalContext.Rule.Message
	}

	body := map[string]interface{}{
		"attachments": []map[string]interface{}{
			{
				"color":       evalContext.GetStateModel().Color,
				"title":       evalContext.GetNotificationTitle(),
				"title_link":  ruleUrl,
				"text":        message,
				"fields":      fields,
				"image_url":   evalContext.ImagePublicUrl,
				"footer":      "Grafana v" + setting.BuildVersion,
				"footer_icon": "http://grafana.org/assets/img/fav32.png",
				"ts":          time.Now().Unix(),
			},
		},
	}

	data, _ := json.Marshal(&body)
	cmd := &m.SendWebhookSync{Url: this.Url, Body: string(data)}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send slack notification", "error", err, "webhook", this.Name)
	}

	return nil
}
