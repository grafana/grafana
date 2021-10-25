package channels

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

// NewSwitNotifier is the constructor for the Swit notifier
func NewSwitNotifier(model *NotificationChannelConfig, t *template.Template, fn GetDecryptedValueFn) (*SwitNotifier, error) {
	url := fn(context.Background(), model.SecureSettings, "url", model.Settings.Get("url").MustString(), setting.SecretKey)
	if url == "" {
		return nil, receiverInitError{Cfg: *model, Reason: "could not find webhook url in settings"}
	}

	return &SwitNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		Url:  url,
		log:  log.New("alerting.notifier.swit"),
		tmpl: t,
	}, nil
}

// SwitNotifier is responsible for sending
// alert notifications to Swit.
type SwitNotifier struct {
	*Base
	Url  string
	log  log.Logger
	tmpl *template.Template
}

// Notify send an alert notification to Swit
func (sn *SwitNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	sn.log.Debug("Executing swit notification", "notification", sn.Name)

	var tmplErr error
	tmpl, _ := TmplText(ctx, sn.tmpl, as, sn.log, &tmplErr)

	message := fmt.Sprintf(
		"%s\n\n%s",
		tmpl(`{{ template "default.title" . }}`),
		tmpl(`{{ template "default.message" . }}`),
	)

	body := map[string]string{
		"text": message,
	}

	st, err := simplejson.NewFromAny(body).Encode()
	if err != nil {
		return false, err
	}

	if tmplErr != nil {
		sn.log.Debug("failed to template swit message", "err", tmplErr.Error())
	}

	cmd := &models.SendWebhookSync{
		Url:        sn.Url,
		Body:       string(st),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"User-Agent":   "Grafana",
			"Content-Type": "application/json",
		},
	}

	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		sn.log.Error("Failed to send notification to Swit", "error", err, "body", body)
		return false, err
	}

	return true, nil
}

func (ln *SwitNotifier) SendResolved() bool {
	return !ln.GetDisableResolveMessage()
}
