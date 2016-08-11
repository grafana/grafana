package notifiers

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier("webhook", NewWebHookNotifier)
}

func NewWebHookNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &WebhookNotifier{
		NotifierBase: NotifierBase{
			Name: model.Name,
			Type: model.Type,
		},
		Url:      url,
		User:     model.Settings.Get("user").MustString(),
		Password: model.Settings.Get("password").MustString(),
		log:      log.New("alerting.notifier.webhook"),
	}, nil
}

type WebhookNotifier struct {
	NotifierBase
	Url      string
	User     string
	Password string
	log      log.Logger
}

func (this *WebhookNotifier) Notify(context *alerting.EvalContext) {
	this.log.Info("Sending webhook")
	metrics.M_Alerting_Notification_Sent_Webhook.Inc(1)

	bodyJSON := simplejson.New()
	bodyJSON.Set("title", context.GetNotificationTitle())
	bodyJSON.Set("ruleId", context.Rule.Id)
	bodyJSON.Set("ruleName", context.Rule.Name)
	bodyJSON.Set("firing", context.Firing)
	bodyJSON.Set("severity", context.Rule.Severity)

	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhook{
		Url:      this.Url,
		User:     this.User,
		Password: this.Password,
		Body:     string(body),
	}

	if err := bus.Dispatch(cmd); err != nil {
		this.log.Error("Failed to send webhook", "error", err, "webhook", this.Name)
	}
}
