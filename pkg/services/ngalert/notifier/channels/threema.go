package channels

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/notifications"
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
	images      ImageStore
	ns          notifications.WebhookSender
	tmpl        *template.Template
}

type ThreemaConfig struct {
	*NotificationChannelConfig
	GatewayID   string
	RecipientID string
	APISecret   string
}

func ThreemaFactory(fc FactoryConfig) (NotificationChannel, error) {
	cfg, err := NewThreemaConfig(fc.Config, fc.DecryptFunc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return NewThreemaNotifier(cfg, fc.ImageStore, fc.NotificationService, fc.Template), nil
}

func NewThreemaConfig(config *NotificationChannelConfig, decryptFunc GetDecryptedValueFn) (*ThreemaConfig, error) {
	gatewayID := config.Settings.Get("gateway_id").MustString()
	if gatewayID == "" {
		return nil, errors.New("could not find Threema Gateway ID in settings")
	}
	if !strings.HasPrefix(gatewayID, "*") {
		return nil, errors.New("invalid Threema Gateway ID: Must start with a *")
	}
	if len(gatewayID) != 8 {
		return nil, errors.New("invalid Threema Gateway ID: Must be 8 characters long")
	}
	recipientID := config.Settings.Get("recipient_id").MustString()
	if recipientID == "" {
		return nil, errors.New("could not find Threema Recipient ID in settings")
	}
	if len(recipientID) != 8 {
		return nil, errors.New("invalid Threema Recipient ID: Must be 8 characters long")
	}
	apiSecret := decryptFunc(context.Background(), config.SecureSettings, "api_secret", config.Settings.Get("api_secret").MustString())
	if apiSecret == "" {
		return nil, errors.New("could not find Threema API secret in settings")
	}
	return &ThreemaConfig{
		NotificationChannelConfig: config,
		GatewayID:                 gatewayID,
		RecipientID:               recipientID,
		APISecret:                 apiSecret,
	}, nil
}

// NewThreemaNotifier is the constructor for the Threema notifier
func NewThreemaNotifier(config *ThreemaConfig, images ImageStore, ns notifications.WebhookSender, t *template.Template) *ThreemaNotifier {
	return &ThreemaNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   config.UID,
			Name:                  config.Name,
			Type:                  config.Type,
			DisableResolveMessage: config.DisableResolveMessage,
			Settings:              config.Settings,
		}),
		GatewayID:   config.GatewayID,
		RecipientID: config.RecipientID,
		APISecret:   config.APISecret,
		log:         log.New("alerting.notifier.threema"),
		images:      images,
		ns:          ns,
		tmpl:        t,
	}
}

// Notify send an alert notification to Threema
func (tn *ThreemaNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	tn.log.Debug("sending threema alert notification", "from", tn.GatewayID, "to", tn.RecipientID)

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

	_ = withStoredImages(ctx, tn.log, tn.images,
		func(index int, image *ngmodels.Image) error {
			fmt.Println("here", index, image)
			if image != nil && image.URL != "" {
				message += fmt.Sprintf("*Image:* %s\n", image.URL)
			}
			return nil
		}, as...)

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
		tn.log.Error("Failed to send threema notification", "err", err, "webhook", tn.Name)
		return false, err
	}

	return true, nil
}

func (tn *ThreemaNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}
