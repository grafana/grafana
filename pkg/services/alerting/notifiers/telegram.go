package notifiers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"os"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const (
	captionLengthLimit = 1024
)

var (
	telegramAPIURL = "https://api.telegram.org/bot%s/%s"
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

// TelegramNotifier is responsible for sending
// alert notifications to Telegram.
type TelegramNotifier struct {
	NotifierBase
	BotToken    string
	ChatID      string
	UploadImage bool
	log         log.Logger
}

// NewTelegramNotifier is the constructor for the Telegram notifier
func NewTelegramNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	botToken := model.Settings.Get("bottoken").MustString()
	chatID := model.Settings.Get("chatid").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool()

	if botToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Bot Token in settings"}
	}

	if chatID == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Chat Id in settings"}
	}

	return &TelegramNotifier{
		NotifierBase: NewNotifierBase(model),
		BotToken:     botToken,
		ChatID:       chatID,
		UploadImage:  uploadImage,
		log:          log.New("alerting.notifier.telegram"),
	}, nil
}

func (tn *TelegramNotifier) buildMessage(evalContext *alerting.EvalContext, sendImageInline bool) *models.SendWebhookSync {
	if sendImageInline {
		cmd, err := tn.buildMessageInlineImage(evalContext)
		if err == nil {
			return cmd
		}
		tn.log.Error("Could not generate Telegram message with inline image.", "err", err)
	}

	return tn.buildMessageLinkedImage(evalContext)
}

func (tn *TelegramNotifier) buildMessageLinkedImage(evalContext *alerting.EvalContext) *models.SendWebhookSync {
	message := fmt.Sprintf("<b>%s</b>\nState: %s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Name, evalContext.Rule.Message)

	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		message = message + fmt.Sprintf("URL: %s\n", ruleURL)
	}

	if evalContext.ImagePublicURL != "" {
		message = message + fmt.Sprintf("Image: %s\n", evalContext.ImagePublicURL)
	}

	metrics := generateMetricsMessage(evalContext)
	if metrics != "" {
		message = message + fmt.Sprintf("\n<i>Metrics:</i>%s", metrics)
	}

	cmd := tn.generateTelegramCmd(message, "text", "sendMessage", func(w *multipart.Writer) {
		fw, _ := w.CreateFormField("parse_mode")
		fw.Write([]byte("html"))
	})
	return cmd
}

func (tn *TelegramNotifier) buildMessageInlineImage(evalContext *alerting.EvalContext) (*models.SendWebhookSync, error) {
	var imageFile *os.File
	var err error

	imageFile, err = os.Open(evalContext.ImageOnDiskPath)
	defer func() {
		err := imageFile.Close()
		if err != nil {
			tn.log.Error("Could not close Telegram inline image.", "err", err)
		}
	}()

	if err != nil {
		return nil, err
	}

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		return nil, err
	}

	metrics := generateMetricsMessage(evalContext)
	message := generateImageCaption(evalContext, ruleURL, metrics)

	cmd := tn.generateTelegramCmd(message, "caption", "sendPhoto", func(w *multipart.Writer) {
		fw, _ := w.CreateFormFile("photo", evalContext.ImageOnDiskPath)
		io.Copy(fw, imageFile)
	})
	return cmd, nil
}

func (tn *TelegramNotifier) generateTelegramCmd(message string, messageField string, apiAction string, extraConf func(writer *multipart.Writer)) *models.SendWebhookSync {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	fw, _ := w.CreateFormField("chat_id")
	fw.Write([]byte(tn.ChatID))

	fw, _ = w.CreateFormField(messageField)
	fw.Write([]byte(message))

	extraConf(w)

	w.Close()

	tn.log.Info("Sending telegram notification", "chat_id", tn.ChatID, "bot_token", tn.BotToken, "apiAction", apiAction)
	url := fmt.Sprintf(telegramAPIURL, tn.BotToken, apiAction)

	cmd := &models.SendWebhookSync{
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

func generateImageCaption(evalContext *alerting.EvalContext, ruleURL string, metrics string) string {
	message := evalContext.GetNotificationTitle()

	if len(evalContext.Rule.Message) > 0 {
		message = fmt.Sprintf("%s\nMessage: %s", message, evalContext.Rule.Message)
	}

	if len(message) > captionLengthLimit {
		message = message[0:captionLengthLimit]

	}

	if len(ruleURL) > 0 {
		urlLine := fmt.Sprintf("\nURL: %s", ruleURL)
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

// Notify send an alert notification to Telegram.
func (tn *TelegramNotifier) Notify(evalContext *alerting.EvalContext) error {
	var cmd *models.SendWebhookSync
	if evalContext.ImagePublicURL == "" && tn.UploadImage {
		cmd = tn.buildMessage(evalContext, true)
	} else {
		cmd = tn.buildMessage(evalContext, false)
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		tn.log.Error("Failed to send webhook", "error", err, "webhook", tn.Name)
		return err
	}

	return nil
}
