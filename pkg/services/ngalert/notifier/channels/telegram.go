package channels

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

var (
	TelegramAPIURL = "https://api.telegram.org/bot%s/%s"
)

// TelegramNotifier is responsible for sending
// alert notifications to Telegram.
type TelegramNotifier struct {
	*Base
	BotToken string
	ChatID   string
	Message  string
	log      log.Logger
	images   ImageStore
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
	return NewTelegramNotifier(config, fc.ImageStore, fc.NotificationService, fc.Template), nil
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
func NewTelegramNotifier(config *TelegramConfig, images ImageStore, ns notifications.WebhookSender, t *template.Template) *TelegramNotifier {
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
		images:   images,
		ns:       ns,
	}
}

// Notify send an alert notification to Telegram.
func (tn *TelegramNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	// Create the cmd for sendMessage
	cmd, err := tn.newWebhookSyncCmd("sendMessage", func(w *multipart.Writer) error {
		msg, err := tn.buildTelegramMessage(ctx, as)
		if err != nil {
			return fmt.Errorf("failed to build message: %w", err)
		}
		for k, v := range msg {
			fw, err := w.CreateFormField(k)
			if err != nil {
				return fmt.Errorf("failed to create form field: %w", err)
			}
			if _, err := fw.Write([]byte(v)); err != nil {
				return fmt.Errorf("failed to write value: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return false, fmt.Errorf("failed to create telegram message: %w", err)
	}
	if err := tn.ns.SendWebhookSync(ctx, cmd); err != nil {
		return false, fmt.Errorf("failed to send telegram message: %w", err)
	}

	// Create the cmd to upload each image
	_ = withStoredImages(ctx, tn.log, tn.images, func(index int, image ngmodels.Image) error {
		cmd, err = tn.newWebhookSyncCmd("sendPhoto", func(w *multipart.Writer) error {
			f, err := os.Open(image.Path)
			if err != nil {
				return fmt.Errorf("failed to open image: %w", err)
			}
			defer func() {
				if err := f.Close(); err != nil {
					tn.log.Warn("failed to close image", "err", err)
				}
			}()
			fw, err := w.CreateFormFile("photo", image.Path)
			if err != nil {
				return fmt.Errorf("failed to create form file: %w", err)
			}
			if _, err := io.Copy(fw, f); err != nil {
				return fmt.Errorf("failed to write to form file: %w", err)
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to create image: %w", err)
		}
		if err := tn.ns.SendWebhookSync(ctx, cmd); err != nil {
			return fmt.Errorf("failed to upload image to telegram: %w", err)
		}
		return nil
	}, as...)

	return true, nil
}

func (tn *TelegramNotifier) buildTelegramMessage(ctx context.Context, as []*types.Alert) (map[string]string, error) {
	var tmplErr error
	defer func() {
		if tmplErr != nil {
			tn.log.Warn("failed to template Telegram message", "err", tmplErr)
		}
	}()

	tmpl, _ := TmplText(ctx, tn.tmpl, as, tn.log, &tmplErr)
	// Telegram supports 4096 chars max
	messageText, truncated := notify.Truncate(tmpl(tn.Message), 4096)
	if truncated {
		tn.log.Warn("Telegram message too long, truncate message", "original_message", tn.Message)
	}

	m := make(map[string]string)
	m["text"] = messageText
	m["parse_mode"] = "html"
	return m, nil
}

func (tn *TelegramNotifier) newWebhookSyncCmd(action string, fn func(writer *multipart.Writer) error) (*models.SendWebhookSync, error) {
	b := bytes.Buffer{}
	w := multipart.NewWriter(&b)

	boundary := GetBoundary()
	if boundary != "" {
		if err := w.SetBoundary(boundary); err != nil {
			return nil, err
		}
	}

	fw, err := w.CreateFormField("chat_id")
	if err != nil {
		return nil, err
	}
	if _, err := fw.Write([]byte(tn.ChatID)); err != nil {
		return nil, err
	}

	if err := fn(w); err != nil {
		return nil, err
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart: %w", err)
	}

	cmd := &models.SendWebhookSync{
		Url:        fmt.Sprintf(TelegramAPIURL, tn.BotToken, action),
		Body:       b.String(),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": w.FormDataContentType(),
		},
	}
	return cmd, nil
}

func (tn *TelegramNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
