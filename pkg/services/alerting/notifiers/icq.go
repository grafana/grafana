package notifiers

import (
	"fmt"
	"github.com/aws/aws-sdk-go/private/protocol"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"net/url"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "icq",
		Name:        "ICQ",
		Description: "Sends notifications to ICQ",
		Factory:     NewICQNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">ICQ API settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-9">BOT API Token</span>
        <input type="text" required	class="gf-form-input" ng-model="ctrl.model.settings.bottoken" placeholder="e.g. 123.1234567890.0123456789:123456789"></input>
        <info-popover mode="right-absolute">You may refer to MegaBot to create a new ICQ bot</info-popover>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-9">Chat ID</span>
        <input type="text" required class="gf-form-input" ng-model="ctrl.model.settings.chatid" placeholder="e.g. 123456789@chat.agent"></input>
        <info-popover mode="right-absolute">You may refer to ChatIDBot to get appropriate ICQ chat identifier</info-popover>
      </div>
    `,
	})
}

type ICQNotifier struct {
	NotifierBase
	BotToken string
	ChatID   string
	log      log.Logger
}

func NewICQNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	botToken := model.Settings.Get("bottoken").MustString()

	if botToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Bot Token in settings"}
	}

	chatId := model.Settings.Get("chatid").MustString()

	if chatId == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Chat Id in settings"}
	}

	return &ICQNotifier{
		NotifierBase: NewNotifierBase(model),
		BotToken:     botToken,
		ChatID:       chatId,
		log:          log.New("alerting.notifier.icq"),
	}, nil
}

func (this *ICQNotifier) Notify(evalContext *alerting.EvalContext) error {

	this.log.Info("Notifying ICQ", "alert_state", evalContext.Rule.State)

	params := url.Values{
		"r":       {protocol.GetIdempotencyToken()},
		"aimsid":  {this.BotToken},
		"t":       {this.ChatID},
		"message": {message(evalContext, this.NeedsImage())},
	}

	cmd := &models.SendWebhookSync{
		Url:        "https://botapi.icq.net/im/sendIM",
		Body:       params.Encode(),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to ICQ", "error", err)
		return err
	}

	return nil
}

func message(evalContext *alerting.EvalContext, needsImage bool) string {
	message := evalContext.GetNotificationTitle()
	if evalContext.Rule.Message != "" {
		message += fmt.Sprintf("\nMessage: %s", evalContext.Rule.Message)
	}
	for _, evt := range evalContext.EvalMatches {
		message += fmt.Sprintf("\n%s: %s", evt.Metric, evt.Value)
	}
	if ruleUrl, err := evalContext.GetRuleUrl(); err == nil {
		message += fmt.Sprintf("\nURL: %s", ruleUrl)
	}
	if needsImage && evalContext.ImagePublicUrl != "" {
		message += fmt.Sprintf("\nImage: %s", evalContext.ImagePublicUrl)
	}
	return message
}
