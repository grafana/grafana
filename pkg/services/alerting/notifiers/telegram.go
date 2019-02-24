package notifiers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"os"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const (
	captionLengthLimit = 1024
)

var (
	telegramApiUrl = "https://api.telegram.org/bot%s/%s"
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
		NotifierBase: NewNotifierBase(model),
		BotToken:     botToken,
		ChatID:       chatId,
		UploadImage:  uploadImage,
		log:          log.New("alerting.notifier.telegram"),
	}, nil
}

func (this *TelegramNotifier) buildMessage(evalContext *alerting.EvalContext, sendImageInline bool) *m.SendWebhookSync {
	if sendImageInline {
		cmd, err := this.buildMessageInlineImage(evalContext)
		if err == nil {
			return cmd
		}
		this.log.Error("Could not generate Telegram message with inline image.", "err", err)
	}

	return this.buildMessageLinkedImage(evalContext)
}

func (this *TelegramNotifier) buildMessageLinkedImage(evalContext *alerting.EvalContext) *m.SendWebhookSync {
	message := fmt.Sprintf("<b>%s</b>\nState: %s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Name, evalContext.Rule.Message)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		message = message + fmt.Sprintf("URL: %s\n", ruleUrl)
	}

	if evalContext.ImagePublicUrl != "" {
		message = message + fmt.Sprintf("Image: %s\n", evalContext.ImagePublicUrl)
	}

	metrics := generateMetricsMessage(evalContext)
	if metrics != "" {
		message = message + fmt.Sprintf("\n<i>Metrics:</i>%s", metrics)
	}

	cmd := this.generateTelegramCmd(message, "text", "sendMessage", func(w *multipart.Writer) {
		fw, _ := w.CreateFormField("parse_mode")
		fw.Write([]byte("html"))
	})
	return cmd
}

func (this *TelegramNotifier) buildMessageInlineImage(evalContext *alerting.EvalContext) (*m.SendWebhookSync, error) {
	var imageFile *os.File
	var err error

	imageFile, err = os.Open(evalContext.ImageOnDiskPath)
	defer func() {
		err := imageFile.Close()
		if err != nil {
			this.log.Error("Could not close Telegram inline image.", "err", err)
		}
	}()

	if err != nil {
		return nil, err
	}

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		return nil, err
	}

	metrics := generateMetricsMessage(evalContext)
	message := generateImageCaption(evalContext, ruleUrl, metrics)

	cmd := this.generateTelegramCmd(message, "caption", "sendPhoto", func(w *multipart.Writer) {
		fw, _ := w.CreateFormFile("photo", evalContext.ImageOnDiskPath)
		io.Copy(fw, imageFile)
	})
	return cmd, nil
}

func (this *TelegramNotifier) generateTelegramCmd(message string, messageField string, apiAction string, extraConf func(writer *multipart.Writer)) *m.SendWebhookSync {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	fw, _ := w.CreateFormField("chat_id")
	fw.Write([]byte(this.ChatID))

	fw, _ = w.CreateFormField(messageField)
	fw.Write([]byte(message))

	extraConf(w)

	w.Close()

	this.log.Info("Sending telegram notification", "chat_id", this.ChatID, "bot_token", this.BotToken, "apiAction", apiAction)
	url := fmt.Sprintf(telegramApiUrl, this.BotToken, apiAction)

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

func generateMetricsMessage(evalContext *alerting.EvalContext) string {
	metrics := ""
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		metrics += fmt.Sprintf("\n%s: %s", evt.Metric, evt.Value)
		if index > fieldLimitCount {
			break
		}
	}
	return metrics
}

func generateImageCaption(evalContext *alerting.EvalContext, ruleUrl string, metrics string) string {
	message := evalContext.GetNotificationTitle()

	if len(evalContext.Rule.Message) > 0 {
		message = fmt.Sprintf("%s\nMessage: %s", message, evalContext.Rule.Message)
	}

	if len(message) > captionLengthLimit {
		message = message[0:captionLengthLimit]

	}

	if len(ruleUrl) > 0 {
		urlLine := fmt.Sprintf("\nURL: %s", ruleUrl)
		message = appendIfPossible(message, urlLine, captionLengthLimit)
	}

	if metrics != "" {
		metricsLines := fmt.Sprintf("\n\nMetrics:%s", metrics)
		message = appendIfPossible(message, metricsLines, captionLengthLimit)
	}

	return message
}

func appendIfPossible(message string, extra string, sizeLimit int) string {
	if len(extra)+len(message) <= sizeLimit {
		return message + extra
	}
	log.Debug("Line too long for image caption. value: %s", extra)
	return message
}

func (this *TelegramNotifier) Notify(evalContext *alerting.EvalContext) error {
	var cmd *m.SendWebhookSync
	if evalContext.ImagePublicUrl == "" && this.UploadImage {
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
