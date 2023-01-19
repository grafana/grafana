package notifiers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
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
		Heading:     "Telegram API settings",
		Factory:     NewTelegramNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "BOT API Token",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "Telegram BOT API Token",
				PropertyName: "bottoken",
				Required:     true,
				Secure:       true,
			},
			{
				Label:        "Chat ID",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Integer Telegram Chat Identifier",
				PropertyName: "chatid",
				Required:     true,
			},
		},
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
func NewTelegramNotifier(model *models.AlertNotification, fn alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	botToken := fn(context.Background(), model.SecureSettings, "bottoken", model.Settings.Get("bottoken").MustString(), setting.SecretKey)
	chatID := model.Settings.Get("chatid").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool()

	if botToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Bot Token in settings"}
	}

	if chatID == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Chat Id in settings"}
	}

	return &TelegramNotifier{
		NotifierBase: NewNotifierBase(model, ns),
		BotToken:     botToken,
		ChatID:       chatID,
		UploadImage:  uploadImage,
		log:          log.New("alerting.notifier.telegram"),
	}, nil
}

func (tn *TelegramNotifier) buildMessage(evalContext *alerting.EvalContext, sendImageInline bool) (*notifications.SendWebhookSync, error) {
	if sendImageInline {
		cmd, err := tn.buildMessageInlineImage(evalContext)
		if err == nil {
			return cmd, nil
		}

		tn.log.Error("Could not generate Telegram message with inline image.", "err", err)
	}

	return tn.buildMessageLinkedImage(evalContext)
}

func (tn *TelegramNotifier) buildMessageLinkedImage(evalContext *alerting.EvalContext) (*notifications.SendWebhookSync, error) {
	message := fmt.Sprintf("<b>%s</b>\nState: %s\nMessage: %s\n", evalContext.GetNotificationTitle(), evalContext.Rule.Name, evalContext.Rule.Message)

	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		message += fmt.Sprintf("URL: %s\n", ruleURL)
	}

	if evalContext.ImagePublicURL != "" {
		message += fmt.Sprintf("Image: %s\n", evalContext.ImagePublicURL)
	}

	metrics := generateMetricsMessage(evalContext)
	if metrics != "" {
		message += fmt.Sprintf("\n<i>Metrics:</i>%s", metrics)
	}

	return tn.generateTelegramCmd(message, "text", "sendMessage", func(w *multipart.Writer) {
		fw, err := w.CreateFormField("parse_mode")
		if err != nil {
			tn.log.Error("Failed to create form file", "err", err)
			return
		}

		if _, err := fw.Write([]byte("html")); err != nil {
			tn.log.Error("Failed to write to form field", "err", err)
		}
	})
}

func (tn *TelegramNotifier) buildMessageInlineImage(evalContext *alerting.EvalContext) (*notifications.SendWebhookSync, error) {
	var imageFile *os.File
	var err error

	imageFile, err = os.Open(evalContext.ImageOnDiskPath)
	if err != nil {
		return nil, err
	}

	defer func() {
		err := imageFile.Close()
		if err != nil {
			tn.log.Error("Could not close Telegram inline image.", "err", err)
		}
	}()

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		return nil, err
	}

	metrics := generateMetricsMessage(evalContext)
	message := generateImageCaption(evalContext, ruleURL, metrics)

	return tn.generateTelegramCmd(message, "caption", "sendPhoto", func(w *multipart.Writer) {
		fw, err := w.CreateFormFile("photo", evalContext.ImageOnDiskPath)
		if err != nil {
			tn.log.Error("Failed to create form file", "err", err)
			return
		}

		if _, err := io.Copy(fw, imageFile); err != nil {
			tn.log.Error("Failed to write to form file", "err", err)
		}
	})
}

func (tn *TelegramNotifier) generateTelegramCmd(message string, messageField string, apiAction string, extraConf func(writer *multipart.Writer)) (*notifications.SendWebhookSync, error) {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	defer func() {
		if err := w.Close(); err != nil {
			tn.log.Warn("Failed to close writer", "err", err)
		}
	}()

	fw, err := w.CreateFormField("chat_id")
	if err != nil {
		return nil, err
	}
	if _, err := fw.Write([]byte(tn.ChatID)); err != nil {
		return nil, err
	}

	fw, err = w.CreateFormField(messageField)
	if err != nil {
		return nil, err
	}
	if _, err := fw.Write([]byte(message)); err != nil {
		return nil, err
	}

	extraConf(w)

	if err := w.Close(); err != nil {
		return nil, err
	}

	tn.log.Info("Sending telegram notification", "chat_id", tn.ChatID, "bot_token", tn.BotToken, "apiAction", apiAction)
	url := fmt.Sprintf(telegramAPIURL, tn.BotToken, apiAction)

	cmd := &notifications.SendWebhookSync{
		Url:        url,
		Body:       body.String(),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": w.FormDataContentType(),
		},
	}
	return cmd, nil
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
		message = appendIfPossible(evalContext.Log, message, urlLine, captionLengthLimit)
	}

	if metrics != "" {
		metricsLines := fmt.Sprintf("\n\nMetrics:%s", metrics)
		message = appendIfPossible(evalContext.Log, message, metricsLines, captionLengthLimit)
	}

	return message
}

func appendIfPossible(tlog log.Logger, message string, extra string, sizeLimit int) string {
	if len(extra)+len(message) <= sizeLimit {
		return message + extra
	}
	tlog.Debug("Line too long for image caption.", "value", extra)
	return message
}

// Notify send an alert notification to Telegram.
func (tn *TelegramNotifier) Notify(evalContext *alerting.EvalContext) error {
	var cmd *notifications.SendWebhookSync
	var err error
	if evalContext.ImagePublicURL == "" && tn.UploadImage {
		cmd, err = tn.buildMessage(evalContext, true)
	} else {
		cmd, err = tn.buildMessage(evalContext, false)
	}
	if err != nil {
		return err
	}

	if err := tn.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		tn.log.Error("Failed to send webhook", "error", err, "webhook", tn.Name)
		return err
	}

	return nil
}
