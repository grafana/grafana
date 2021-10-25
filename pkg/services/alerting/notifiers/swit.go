package notifiers

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "swit",
		Name:        "Swit",
		Heading:     "Swit API settings",
		Description: "Sends notifications to Swit",
		Info:        "",
		Factory:     NewSwitNotifier,
		Options: []alerting.NotifierOption{
			{
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Label:        "WebHook URL",
				Placeholder:  "Swit Webhook URL",
				PropertyName: "webhookurl",
				Required:     true,
				Secure:       true,
			},
		},
	})
}

func NewSwitNotifier(model *models.AlertNotification, fn alerting.GetDecryptedValueFn) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	u := fn(context.Background(), model.SecureSettings, "webhookurl", model.Settings.Get("webhookurl").MustString(), setting.SecretKey)

	if u == "" {
		return nil, alerting.ValidationError{
			Reason: "Could not find webhook url in settings",
		}
	}

	return &SwitNotifier{
		WebhookURL: u,
		log:        log.New("alerting.notifier.swit"),
	}, nil
}

type SwitNotifier struct {
	NotifierBase
	WebhookURL string
	log        log.Logger
}

func (sn *SwitNotifier) Notify(evalContext *alerting.EvalContext) error {
	sn.log.Info("Executing swit webhook notification", "ruleId", evalContext.Rule.ID, "notification", sn.Name)

	message := fmt.Sprintf("%s\nState: %s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Name, evalContext.Rule.Message)
	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		message += fmt.Sprintf("URL: %s\n", ruleURL)
	}

	if evalContext.ImagePublicURL != "" {
		message += fmt.Sprintf("Image: %s\n", evalContext.ImagePublicURL)
	}

	metrics := generateMetricsMessage(evalContext)
	if metrics != "" {
		message += fmt.Sprintf("\nMetrics:%s", metrics)
	}

	body := map[string]string{
		"text": message,
	}

	st, err := simplejson.NewFromAny(body).Encode()
	if err != nil {
		return err
	}

	fmt.Println(st)

	cmd := &models.SendWebhookSync{
		Url:        sn.WebhookURL,
		Body:       string(st),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"User-Agent":   "Grafana",
			"Content-Type": "application/application",
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		sn.log.Error("Failed to send Notification to Swit", "error", err, "body")
	}

	return nil
}
