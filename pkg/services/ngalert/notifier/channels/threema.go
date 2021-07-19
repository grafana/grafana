package channels

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	old_notifiers "github.com/grafana/grafana/pkg/services/alerting/notifiers"
)

var (
	ThreemaGwBaseURL = "https://msgapi.threema.ch/send_simple"
)

// ThreemaNotifier is responsible for sending
// alert notifications to Threema.
type ThreemaNotifier struct {
	old_notifiers.NotifierBase
	GatewayID   string
	RecipientID string
	APISecret   string
	log         log.Logger
	tmpl        *template.Template
}

// NewThreemaNotifier is the constructor for the Threema notifier
func NewThreemaNotifier(model *NotificationChannelConfig, t *template.Template) (*ThreemaNotifier, error) {
	if model.Settings == nil {
		return nil, receiverInitError{Cfg: *model, Reason: "no settings supplied"}
	}

	gatewayID := model.Settings.Get("gateway_id").MustString()
	recipientID := model.Settings.Get("recipient_id").MustString()
	apiSecret := model.DecryptedValue("api_secret", model.Settings.Get("api_secret").MustString())

	// Validation
	if gatewayID == "" {
		return nil, receiverInitError{Cfg: *model, Reason: "could not find Threema Gateway ID in settings"}
	}
	if !strings.HasPrefix(gatewayID, "*") {
		return nil, receiverInitError{Cfg: *model, Reason: "invalid Threema Gateway ID: Must start with a *"}
	}
	if len(gatewayID) != 8 {
		return nil, receiverInitError{Cfg: *model, Reason: "invalid Threema Gateway ID: Must be 8 characters long"}
	}
	if recipientID == "" {
		return nil, receiverInitError{Cfg: *model, Reason: "could not find Threema Recipient ID in settings"}
	}
	if len(recipientID) != 8 {
		return nil, receiverInitError{Cfg: *model, Reason: "invalid Threema Recipient ID: Must be 8 characters long"}
	}
	if apiSecret == "" {
		return nil, receiverInitError{Cfg: *model, Reason: "could not find Threema API secret in settings"}
	}

	return &ThreemaNotifier{
		NotifierBase: old_notifiers.NewNotifierBase(&models.AlertNotification{
			Uid:                   model.UID,
			Name:                  model.Name,
			Type:                  model.Type,
			DisableResolveMessage: model.DisableResolveMessage,
			Settings:              model.Settings,
		}),
		GatewayID:   gatewayID,
		RecipientID: recipientID,
		APISecret:   apiSecret,
		log:         log.New("alerting.notifier.threema"),
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
		tmpl(`{{ template "default.title" . }}`),
		tmpl(`{{ template "default.message" . }}`),
		path.Join(tn.tmpl.ExternalURL.String(), "/alerting/list"),
	)
	data.Set("text", message)

	if tmplErr != nil {
		tn.log.Debug("failed to template Threema message", "err", tmplErr.Error())
	}

	cmd := &models.SendWebhookSync{
		Url:        ThreemaGwBaseURL,
		Body:       data.Encode(),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
		},
	}
	if err := bus.DispatchCtx(ctx, cmd); err != nil {
		tn.log.Error("Failed to send threema notification", "error", err, "webhook", tn.Name)
		return false, err
	}

	return true, nil
}

func (tn *ThreemaNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
