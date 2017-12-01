package notifiers

import (
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

var (
	telegeramApiUrl string = "https://api.telegram.org/bot%s/%s"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "telegram",
		Name:        "Telegram",
		Description: "Sends notifications to Telegram",
		Factory:     NewTelegramNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Telegram API settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-9">BOT API Token</span>
        <input type="text" required
					class="gf-form-input"
					ng-model="ctrl.model.settings.bottoken"
					placeholder="Telegram BOT API Token"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-9">Chat ID</span>
        <input type="text" required
					class="gf-form-input"
					ng-model="ctrl.model.settings.chatid"
					data-placement="right">
        </input>
        <info-popover mode="right-absolute">
					Integer Telegram Chat Identifier
        </info-popover>
      </div>
    `,
	})

}

type TelegramNotifier struct {
	NotifierBase
	BotToken string
	ChatID   string
	log      log.Logger
}

func NewTelegramNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	botToken := model.Settings.Get("bottoken").MustString()
	chatId := model.Settings.Get("chatid").MustString()

	if botToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Bot Token in settings"}
	}

	if chatId == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Chat Id in settings"}
	}

	return &TelegramNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		BotToken:     botToken,
		ChatID:       chatId,
		log:          log.New("alerting.notifier.telegram"),
	}, nil
}

func (this *TelegramNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending alert notification to", "bot_token", this.BotToken)
	this.log.Info("Sending alert notification to", "chat_id", this.ChatID)

	bodyJSON := simplejson.New()

	bodyJSON.Set("chat_id", this.ChatID)
	bodyJSON.Set("parse_mode", "html")

	message := fmt.Sprintf("<b>%s</b>\nState: %s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Name, evalContext.Rule.Message)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		message = message + fmt.Sprintf("URL: %s\n", ruleUrl)
	}
	if evalContext.ImagePublicUrl != "" {
		message = message + fmt.Sprintf("Image: %s\n", evalContext.ImagePublicUrl)
	}

	metrics := ""
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		metrics += fmt.Sprintf("\n%s: %s", evt.Metric, evt.Value)
		if index > fieldLimitCount {
			break
		}
	}
	if metrics != "" {
		message = message + fmt.Sprintf("\n<i>Metrics:</i>%s", metrics)
	}

	bodyJSON.Set("text", message)

	url := fmt.Sprintf(telegeramApiUrl, this.BotToken, "sendMessage")
	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhookSync{
		Url:        url,
		Body:       string(body),
		HttpMethod: "POST",
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send webhook", "error", err, "webhook", this.Name)
		return err
	}

	return nil
}
