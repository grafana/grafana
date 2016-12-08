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
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Url:          url,
		User:         model.Settings.Get("user").MustString(),
		Password:     model.Settings.Get("password").MustString(),
		HttpMethod:   model.Settings.Get("httpMethod").MustString("POST"),
		log:          log.New("alerting.notifier.webhook"),
	}, nil
}

type WebhookNotifier struct {
	NotifierBase
	Url        string
	User       string
	Password   string
	HttpMethod string
	log        log.Logger
}

func (this *WebhookNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending webhook")
	metrics.M_Alerting_Notification_Sent_Webhook.Inc(1)

	bodyJSON := simplejson.New()
	bodyJSON.Set("title", evalContext.GetNotificationTitle())
	bodyJSON.Set("ruleId", evalContext.Rule.Id)
	bodyJSON.Set("ruleName", evalContext.Rule.Name)
	bodyJSON.Set("state", evalContext.Rule.State)
	bodyJSON.Set("evalMatches", evalContext.EvalMatches)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		bodyJSON.Set("ruleUrl", ruleUrl)
	}

	if evalContext.ImagePublicUrl != "" {
		bodyJSON.Set("imageUrl", evalContext.ImagePublicUrl)
	}

	if evalContext.Rule.Message != "" {
		bodyJSON.Set("message", evalContext.Rule.Message)
	}

	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhookSync{
		Url:        this.Url,
		User:       this.User,
		Password:   this.Password,
		Body:       string(body),
		HttpMethod: this.HttpMethod,
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send webhook", "error", err, "webhook", this.Name)
	}

	return nil
}
