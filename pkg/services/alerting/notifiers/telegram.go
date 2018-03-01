package notifiers

import (
	"bytes"
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"io"
	"mime/multipart"
	"os"
)

var (
	telegramApiUrl string = "https://api.telegram.org/bot%s/%s"
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
	BotToken    string
	ChatID      string
	UploadImage bool
	log         log.Logger
}

func NewTelegramNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	botToken := model.Settings.Get("bottoken").MustString()
	chatId := model.Settings.Get("chatid").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool()

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
		UploadImage:  uploadImage,
		log:          log.New("alerting.notifier.telegram"),
	}, nil
}

func (this *TelegramNotifier) buildMessage(evalContext *alerting.EvalContext, sendImageInline bool) *m.SendWebhookSync {
	var imageFile *os.File
	var err error

	if sendImageInline {
		imageFile, err = os.Open(evalContext.ImageOnDiskPath)
		defer imageFile.Close()
		if err != nil {
			sendImageInline = false // fall back to text message
		}
	}

	message := ""

	if sendImageInline {
		// Telegram's API does not allow HTML formatting for image captions.
		message = fmt.Sprintf("%s\nState: %s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Name, evalContext.Rule.Message)
	} else {
		message = fmt.Sprintf("<b>%s</b>\nState: %s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Name, evalContext.Rule.Message)
	}

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		message = message + fmt.Sprintf("URL: %s\n", ruleUrl)
	}

	if !sendImageInline {
		// only attach this if we are not sending it inline.
		if evalContext.ImagePublicUrl != "" {
			message = message + fmt.Sprintf("Image: %s\n", evalContext.ImagePublicUrl)
		}
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
		if sendImageInline {
			// Telegram's API does not allow HTML formatting for image captions.
			message = message + fmt.Sprintf("\nMetrics:%s", metrics)
		} else {
			message = message + fmt.Sprintf("\n<i>Metrics:</i>%s", metrics)
		}
	}

	var body bytes.Buffer

	w := multipart.NewWriter(&body)
	fw, _ := w.CreateFormField("chat_id")
	fw.Write([]byte(this.ChatID))

	if sendImageInline {
		fw, _ = w.CreateFormField("caption")
		fw.Write([]byte(message))

		fw, _ = w.CreateFormFile("photo", evalContext.ImageOnDiskPath)
		io.Copy(fw, imageFile)
	} else {
		fw, _ = w.CreateFormField("text")
		fw.Write([]byte(message))

		fw, _ = w.CreateFormField("parse_mode")
		fw.Write([]byte("html"))
	}

	w.Close()

	apiMethod := ""
	if sendImageInline {
		this.log.Info("Sending telegram image notification", "photo", evalContext.ImageOnDiskPath, "chat_id", this.ChatID, "bot_token", this.BotToken)
		apiMethod = "sendPhoto"
	} else {
		this.log.Info("Sending telegram text notification", "chat_id", this.ChatID, "bot_token", this.BotToken)
		apiMethod = "sendMessage"
	}

	url := fmt.Sprintf(telegramApiUrl, this.BotToken, apiMethod)
	cmd := &m.SendWebhookSync{
		Url:        url,
		Body:       body.String(),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": w.FormDataContentType(),
		},
	}
	return cmd
}

func (this *TelegramNotifier) ShouldNotify(context *alerting.EvalContext) bool {
	return defaultShouldNotify(context)
}

func (this *TelegramNotifier) Notify(evalContext *alerting.EvalContext) error {
	var cmd *m.SendWebhookSync
	if evalContext.ImagePublicUrl == "" && this.UploadImage == true {
		cmd = this.buildMessage(evalContext, true)
	} else {
		cmd = this.buildMessage(evalContext, false)
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send webhook", "error", err, "webhook", this.Name)
		return err
	}

	return nil
}
