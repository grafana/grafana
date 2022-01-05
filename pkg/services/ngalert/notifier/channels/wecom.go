package channels

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/prometheus/alertmanager/types"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/prometheus/alertmanager/template"
)

// NewWeComNotifier is the constructor for WeCom notifier.
func NewWeComNotifier(model *NotificationChannelConfig, t *template.Template, fn GetDecryptedValueFn) (*WeComNotifier, error) {
	url := fn(context.Background(), model.SecureSettings, "url", model.Settings.Get("url").MustString())

	if url == "" {
		return nil, receiverInitError{Cfg: *model, Reason: "could not find webhook URL in settings"}
	}

	return &WeComNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		URL:     url,
		log:     log.New("alerting.notifier.wecom"),
		Message: model.Settings.Get("message").MustString(`{{ template "default.message" .}}`),
		tmpl:    t,
	}, nil
}

// WeComNotifier is responsible for sending alert notifications to WeCom.
type WeComNotifier struct {
	*Base
	URL     string
	Message string
	tmpl    *template.Template
	log     log.Logger
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
		tmpl(`{{ template "default.title" . }}`),
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

	if err := bus.Dispatch(ctx, cmd); err != nil {
		w.log.Error("failed to send WeCom webhook", "error", err, "notification", w.Name)
		return false, err
	}

	return true, nil
}

func (w *WeComNotifier) SendResolved() bool {
	return !w.GetDisableResolveMessage()
}
