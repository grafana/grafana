package channels

import (
	"context"
	"fmt"
	"net/url"
	"path"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

var (
	ThreemaGwBaseURL = "https://msgapi.threema.ch/send_simple"
)

// ThreemaNotifier is responsible for sending
// alert notifications to Threema.
type ThreemaNotifier struct {
	*Base
	GatewayID   string
	RecipientID string
	APISecret   string
	log         log.Logger
	ns          notifications.WebhookSender
	tmpl        *template.Template
}

// NewThreemaNotifier is the constructor for the Threema notifier
func NewThreemaNotifier(model *NotificationChannelConfig, ns notifications.WebhookSender, t *template.Template, fn GetDecryptedValueFn) (*ThreemaNotifier, error) {
	if model.Settings == nil {
		return nil, receiverInitError{Cfg: *model, Reason: "no settings supplied"}
	}
	if model.SecureSettings == nil {
		return nil, receiverInitError{Cfg: *model, Reason: "no secure settings supplied"}
	}
	if valid, err := ValidateContactPointReceiverWithSecure(model.Type, model.Settings, model.SecureSettings, fn); err != nil || !valid {
		return nil, receiverInitError{Cfg: *model, Reason: err.Error()}
	}
	return &ThreemaNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		GatewayID:   model.Settings.Get("gateway_id").MustString(),
		RecipientID: model.Settings.Get("recipient_id").MustString(),
		APISecret:   fn(context.Background(), model.SecureSettings, "api_secret", model.Settings.Get("api_secret").MustString()),
		log:         log.New("alerting.notifier.threema"),
		ns:          ns,
		tmpl:        t,
	}, nil
}

// Notify send an alert notification to Threema
func (tn *ThreemaNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	tn.log.Debug("Sending threema alert notification", "from", tn.GatewayID, "to", tn.RecipientID)

	var tmplErr error
	tmpl, _ := TmplText(ctx, tn.tmpl, as, tn.log, &tmplErr)

	// Set up basic API request data
	data := url.Values{}
	data.Set("from", tn.GatewayID)
	data.Set("to", tn.RecipientID)
	data.Set("secret", tn.APISecret)

	// Determine emoji
	stateEmoji := "\u26A0\uFE0F " // Warning sign
	alerts := types.Alerts(as...)
	if alerts.Status() == model.AlertResolved {
		stateEmoji = "\u2705 " // Check Mark Button
	}

	// Build message
	message := fmt.Sprintf("%s%s\n\n*Message:*\n%s\n*URL:* %s\n",
		stateEmoji,
		tmpl(DefaultMessageTitleEmbed),
		tmpl(`{{ template "default.message" . }}`),
		path.Join(tn.tmpl.ExternalURL.String(), "/alerting/list"),
	)
	data.Set("text", message)

	if tmplErr != nil {
		tn.log.Warn("failed to template Threema message", "err", tmplErr.Error())
	}

	cmd := &models.SendWebhookSync{
		Url:        ThreemaGwBaseURL,
		Body:       data.Encode(),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
		},
	}
	if err := tn.ns.SendWebhookSync(ctx, cmd); err != nil {
		tn.log.Error("Failed to send threema notification", "error", err, "webhook", tn.Name)
		return false, err
	}

	return true, nil
}

func (tn *ThreemaNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
