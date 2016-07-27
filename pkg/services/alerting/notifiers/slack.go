package notifiers

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
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
		return nil, alerting.AlertValidationError{Reason: "Could not find url property in settings"}
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

func (this *SlackNotifier) Notify(context *alerting.AlertResultContext) {
	this.log.Info("Executing slack notification", "ruleId", context.Rule.Id, "notification", this.Name)

	rule := context.Rule

	ruleLink, err := getRuleLink(rule)
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return
	}

	stateText := string(rule.Severity)
	if !context.Firing {
		stateText = "ok"
	}

	text := fmt.Sprintf("[%s]: <%s|%s>", stateText, ruleLink, rule.Name)

	body := simplejson.New()
	body.Set("text", text)

	data, _ := body.MarshalJSON()
	cmd := &m.SendWebhook{Url: this.Url, Body: string(data)}

	if err := bus.Dispatch(cmd); err != nil {
		this.log.Error("Failed to send slack notification", "error", err, "webhook", this.Name)
	}
}
