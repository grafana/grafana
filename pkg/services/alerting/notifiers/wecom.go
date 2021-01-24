package notifiers

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

// WecomNotifier is responsible for sending alert notification to Wecom group robot
type WecomNotifier struct {
	NotifierBase
	Webhook string
	log     log.Logger
}

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "wecom",
		Name:        "Wecom",
		Description: "Sends notifications using Wecom group robot",
		Factory:     newWecomNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Webhook",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "Your Wecom Group Robot Webhook URL",
				PropertyName: "webhook",
				Required:     true,
			},
		},
	})
}

func newWecomNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	webhook := model.Settings.Get("webhook").MustString()
	if webhook == "" {
		return nil, alerting.ValidationError{Reason: "Could not find webhook in settings"}
	}
	return &WecomNotifier{
		NotifierBase: NewNotifierBase(model),
		Webhook:      model.Settings.Get("webhook").MustString(),
		log:          log.New("alerting.notifier.wecom"),
	}, nil
}

// Notify sends the alert notification to Wecom group robot
func (w *WecomNotifier) Notify(evalContext *alerting.EvalContext) error {
	w.log.Info("Sending Wecom Group Robot")

	content := fmt.Sprintf("%v\n%v\n",
		evalContext.GetNotificationTitle(),
		evalContext.Rule.Message,
	)

	if evalContext.ImagePublicURL != "" {
		content += fmt.Sprintf("[%s](%s)\n", evalContext.ImagePublicURL, evalContext.ImagePublicURL)
	}

	for i, match := range evalContext.EvalMatches {
		content += fmt.Sprintf("\n%2d. %s: `%s`", i+1, match.Metric, match.Value)
	}

	body := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"content": content,
		},
	}

	bodyJSON, err := json.Marshal(body)
	if err != nil {
		w.log.Error("Failed to marshal body", "error", err)
		return err
	}

	cmd := &models.SendWebhookSync{
		Url:  w.Webhook,
		Body: string(bodyJSON),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		w.log.Error("Failed to send Wecom", "error", err)
		return err
	}

	return nil
}
