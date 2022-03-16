package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/prometheus/alertmanager/template"
)

type WeComConfig struct {
	*NotificationChannelConfig
	URL     string
	Message string
}

func WeComFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewWeComConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewWeComNotifier(cfg, fc.NotificationService, fc.Template), nil
}

func NewWeComConfig(config *NotificationChannelConfig, decryptFunc GetDecryptedValueFn) (*WeComConfig, error) {
	url := decryptFunc(context.Background(), config.SecureSettings, "url", config.Settings.Get("url").MustString())
	if url == "" {
		return nil, errors.New("could not find webhook URL in settings")
	}
	return &WeComConfig{
		NotificationChannelConfig: config,
		URL:                       url,
		Message:                   config.Settings.Get("message").MustString(`{{ template "default.message" .}}`),
	}, nil
}

// NewWeComNotifier is the constructor for WeCom notifier.
func NewWeComNotifier(config *WeComConfig, ns notifications.WebhookSender, t *template.Template) *WeComNotifier {
	return &WeComNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		URL:     config.URL,
		Message: config.Message,
		log:     log.New("alerting.notifier.wecom"),
		ns:      ns,
		tmpl:    t,
	}
}

// WeComNotifier is responsible for sending alert notifications to WeCom.
type WeComNotifier struct {
	*Base
	URL     string
	Message string
	tmpl    *template.Template
	log     log.Logger
	ns      notifications.WebhookSender
}

// Notify send an alert notification to WeCom.
func (w *WeComNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	w.log.Info("executing WeCom notification", "notification", w.Name)

	var tmplErr error
	tmpl, _ := TmplText(ctx, w.tmpl, as, w.log, &tmplErr)

	bodyMsg := map[string]interface{}{
		"msgtype": "markdown",
	}
	content := fmt.Sprintf("# %s\n%s\n",
		tmpl(DefaultMessageTitleEmbed),
		tmpl(w.Message),
	)

	bodyMsg["markdown"] = map[string]interface{}{
		"content": content,
	}

	body, err := json.Marshal(bodyMsg)
	if err != nil {
		return false, err
	}

	cmd := &models.SendWebhookSync{
		Url:  w.URL,
		Body: string(body),
	}

	if err := w.ns.SendWebhookSync(ctx, cmd); err != nil {
		w.log.Error("failed to send WeCom webhook", "error", err, "notification", w.Name)
		return false, err
	}

	return true, nil
}

func (w *WeComNotifier) SendResolved() bool {
	return !w.GetDisableResolveMessage()
}
