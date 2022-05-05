package channels

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"mime/multipart"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

var (
	TelegramAPIURL = "https://api.telegram.org/bot%s/sendMessage"
)

// TelegramNotifier is responsible for sending
// alert notifications to Telegram.
type TelegramNotifier struct {
	*Base
	BotToken string
	ChatID   string
	Message  string
	log      log.Logger
	ns       notifications.WebhookSender
	tmpl     *template.Template
}

type TelegramConfig struct {
	*NotificationChannelConfig
	BotToken string
	ChatID   string
	Message  string
}

func TelegramFactory(fc FactoryConfig) (NotificationChannel, error) {
	config, err := NewTelegramConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewTelegramNotifier(config, fc.NotificationService, fc.Template), nil
}

func NewTelegramConfig(config *NotificationChannelConfig, fn GetDecryptedValueFn) (*TelegramConfig, error) {
	botToken := fn(context.Background(), config.SecureSettings, "bottoken", config.Settings.Get("bottoken").MustString())
	if botToken == "" {
		return &TelegramConfig{}, errors.New("could not find Bot Token in settings")
	}
	chatID := config.Settings.Get("chatid").MustString()
	if chatID == "" {
		return &TelegramConfig{}, errors.New("could not find Chat Id in settings")
	}
	return &TelegramConfig{
		NotificationChannelConfig: config,
		BotToken:                  botToken,
		ChatID:                    chatID,
		Message:                   config.Settings.Get("message").MustString(`{{ template "default.message" . }}`),
	}, nil
}

// NewTelegramNotifier is the constructor for the Telegram notifier
func NewTelegramNotifier(config *TelegramConfig, ns notifications.WebhookSender, t *template.Template) *TelegramNotifier {
	return &TelegramNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		BotToken: config.BotToken,
		ChatID:   config.ChatID,
		Message:  config.Message,
		tmpl:     t,
		log:      log.New("alerting.notifier.telegram"),
		ns:       ns,
	}
}

// Notify send an alert notification to Telegram.
func (tn *TelegramNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	msg, err := tn.buildTelegramMessage(ctx, as)
	if err != nil {
		return false, err
	}

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	defer func() {
		if err := w.Close(); err != nil {
			tn.log.Warn("Failed to close writer", "err", err)
		}
	}()
	boundary := GetBoundary()
	if boundary != "" {
		err = w.SetBoundary(boundary)
		if err != nil {
			return false, err
		}
	}

	for k, v := range msg {
		if err := writeField(w, k, v); err != nil {
			return false, err
		}
	}

	// We need to close it before using so that the last part
	// is added to the writer along with the boundary.
	if err := w.Close(); err != nil {
		return false, err
	}

	tn.log.Info("sending telegram notification", "chat_id", msg["chat_id"])
	cmd := &models.SendWebhookSync{
		Url:        fmt.Sprintf(TelegramAPIURL, tn.BotToken),
		Body:       body.String(),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": w.FormDataContentType(),
		},
	}

	if err := tn.ns.SendWebhookSync(ctx, cmd); err != nil {
		tn.log.Error("Failed to send webhook", "error", err, "webhook", tn.Name)
		return false, err
	}

	return true, nil
}

func (tn *TelegramNotifier) buildTelegramMessage(ctx context.Context, as []*types.Alert) (map[string]string, error) {
	var tmplErr error
	tmpl, _ := TmplText(ctx, tn.tmpl, as, tn.log, &tmplErr)

	msg := map[string]string{}
	msg["chat_id"] = tmpl(tn.ChatID)
	msg["parse_mode"] = "html"

	message := tmpl(tn.Message)
	if tmplErr != nil {
		tn.log.Warn("failed to template Telegram message", "err", tmplErr.Error())
	}

	msg["text"] = message

	return msg, nil
}

func writeField(w *multipart.Writer, name, value string) error {
	fw, err := w.CreateFormField(name)
	if err != nil {
		return err
	}
	if _, err := fw.Write([]byte(value)); err != nil {
		return err
	}
	return nil
}

func (tn *TelegramNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
