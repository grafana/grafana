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
	log      log.Logger
	images   ImageStore
	ns       notifications.WebhookSender
	tmpl     *template.Template
	settings telegramSettings
}

type telegramSettings struct {
	BotToken string `json:"bottoken,omitempty" yaml:"bottoken,omitempty"`
	ChatID   string `json:"chatid,omitempty" yaml:"chatid,omitempty"`
	Message  string `json:"message,omitempty" yaml:"message,omitempty"`
}

func buildTelegramSettings(fc FactoryConfig) (telegramSettings, error) {
	settings := telegramSettings{}
	err := fc.Config.unmarshalSettings(&settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	settings.BotToken = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "bottoken", settings.BotToken)
	if settings.BotToken == "" {
		return settings, errors.New("could not find Bot Token in settings")
	}
	if settings.ChatID == "" {
		return settings, errors.New("could not find Chat Id in settings")
	}
	if settings.Message == "" {
		settings.Message = DefaultMessageEmbed
	}
	return settings, nil
}

func TelegramFactory(fc FactoryConfig) (NotificationChannel, error) {
	notifier, err := NewTelegramNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

// NewTelegramNotifier is the constructor for the Telegram notifier
func NewTelegramNotifier(fc FactoryConfig) (*TelegramNotifier, error) {
	settings, err := buildTelegramSettings(fc)
	if err != nil {
		return nil, err
	}
	return &TelegramNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
		}),
		tmpl:     fc.Template,
		log:      log.New("alerting.notifier.telegram"),
		images:   fc.ImageStore,
		ns:       fc.NotificationService,
		settings: settings,
	}, nil
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
					tn.log.Warn("failed to close image", "error", err)
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
			tn.log.Warn("failed to template Telegram message", "error", tmplErr)
		}
	}()

	tmpl, _ := TmplText(ctx, tn.tmpl, as, tn.log, &tmplErr)
	// Telegram supports 4096 chars max
	messageText, truncated := notify.TruncateInRunes(tmpl(tn.settings.Message), 4096)
	if truncated {
		tn.log.Warn("Telegram message too long, truncate message", "original_message", tn.settings.Message)
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
	if _, err := fw.Write([]byte(tn.settings.ChatID)); err != nil {
		return nil, err
	}

	if err := fn(w); err != nil {
		return nil, err
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart: %w", err)
	}

	cmd := &models.SendWebhookSync{
		Url:        fmt.Sprintf(TelegramAPIURL, tn.settings.BotToken, action),
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
