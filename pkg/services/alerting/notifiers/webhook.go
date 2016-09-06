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
		NotifierBase: NewNotifierBase(model.Name, model.Type, model.Settings),
		Url:          url,
		User:         model.Settings.Get("user").MustString(),
		Password:     model.Settings.Get("password").MustString(),
		log:          log.New("alerting.notifier.webhook"),
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
	bodyJSON.Set("state", context.Rule.State)
	bodyJSON.Set("severity", context.Rule.Severity)
	bodyJSON.Set("evalMatches", context.EvalMatches)

	ruleUrl, err := context.GetRuleUrl()
	if err == nil {
		bodyJSON.Set("rule_url", ruleUrl)
	}

	imageUrl, err := context.GetImageUrl()
	if err == nil {
		bodyJSON.Set("image_url", imageUrl)
	}

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
