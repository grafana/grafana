package channels

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
)

type wecomSettings struct {
	URL     string `json:"url" yaml:"url"`
	Message string `json:"message,omitempty" yaml:"message,omitempty"`
	Title   string `json:"title,omitempty" yaml:"title,omitempty"`
}

func buildWecomSettings(factoryConfig FactoryConfig) (wecomSettings, error) {
	var settings = wecomSettings{}

	err := factoryConfig.Config.unmarshalSettings(&settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	if settings.Message == "" {
		settings.Message = DefaultMessageEmbed
	}
	if settings.Title == "" {
		settings.Title = DefaultMessageTitleEmbed
	}

	settings.URL = factoryConfig.DecryptFunc(context.Background(), factoryConfig.Config.SecureSettings, "url", settings.URL)
	if settings.URL == "" {
		return settings, errors.New("could not find webhook URL in settings")
	}
	return settings, nil
}

func WeComFactory(fc FactoryConfig) (NotificationChannel, error) {
	ch, err := buildWecomNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return ch, nil
}

func buildWecomNotifier(factoryConfig FactoryConfig) (*WeComNotifier, error) {
	settings, err := buildWecomSettings(factoryConfig)
	if err != nil {
		return nil, err
	}
	return &WeComNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   factoryConfig.Config.UID,
			Name:                  factoryConfig.Config.Name,
			Type:                  factoryConfig.Config.Type,
			DisableResolveMessage: factoryConfig.Config.DisableResolveMessage,
			Settings:              factoryConfig.Config.Settings,
		}),
		tmpl:     factoryConfig.Template,
		log:      log.New("alerting.notifier.wecom"),
		ns:       factoryConfig.NotificationService,
		settings: settings,
	}, nil
}

// WeComNotifier is responsible for sending alert notifications to WeCom.
type WeComNotifier struct {
	*Base
	tmpl     *template.Template
	log      log.Logger
	ns       notifications.WebhookSender
	settings wecomSettings
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
		tmpl(w.settings.Title),
		tmpl(w.settings.Message),
	)

	bodyMsg["markdown"] = map[string]interface{}{
		"content": content,
	}

	body, err := json.Marshal(bodyMsg)
	if err != nil {
		return false, err
	}

	cmd := &models.SendWebhookSync{
		Url:  w.settings.URL,
		Body: string(body),
	}

	if err := w.ns.SendWebhookSync(ctx, cmd); err != nil {
		w.log.Error("failed to send WeCom webhook", "err", err, "notification", w.Name)
		return false, err
	}

	return true, nil
}

func (w *WeComNotifier) SendResolved() bool {
	return !w.GetDisableResolveMessage()
}
