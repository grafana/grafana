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
)

var (
	ThreemaGwBaseURL = "https://msgapi.threema.ch/send_simple"
)

// ThreemaNotifier is responsible for sending
// alert notifications to Threema.
type ThreemaNotifier struct {
	*Base
	log      log.Logger
	images   ImageStore
	ns       WebhookSender
	tmpl     *template.Template
	settings threemaSettings
}

type threemaSettings struct {
	GatewayID   string `json:"gateway_id,omitempty" yaml:"gateway_id,omitempty"`
	RecipientID string `json:"recipient_id,omitempty" yaml:"recipient_id,omitempty"`
	APISecret   string `json:"api_secret,omitempty" yaml:"api_secret,omitempty"`
	Title       string `json:"title,omitempty" yaml:"title,omitempty"`
	Description string `json:"description,omitempty" yaml:"description,omitempty"`
}

func buildThreemaSettings(fc FactoryConfig) (threemaSettings, error) {
	settings := threemaSettings{}
	err := fc.Config.unmarshalSettings(&settings)
	if err != nil {
		return settings, fmt.Errorf("failed to unmarshal settings: %w", err)
	}
	// GatewayID validaiton
	if settings.GatewayID == "" {
		return settings, errors.New("could not find Threema Gateway ID in settings")
	}
	if !strings.HasPrefix(settings.GatewayID, "*") {
		return settings, errors.New("invalid Threema Gateway ID: Must start with a *")
	}
	if len(settings.GatewayID) != 8 {
		return settings, errors.New("invalid Threema Gateway ID: Must be 8 characters long")
	}

	// RecipientID validation
	if settings.RecipientID == "" {
		return settings, errors.New("could not find Threema Recipient ID in settings")
	}
	if len(settings.RecipientID) != 8 {
		return settings, errors.New("invalid Threema Recipient ID: Must be 8 characters long")
	}
	settings.APISecret = fc.DecryptFunc(context.Background(), fc.Config.SecureSettings, "api_secret", settings.APISecret)
	if settings.APISecret == "" {
		return settings, errors.New("could not find Threema API secret in settings")
	}

	if settings.Description == "" {
		settings.Description = DefaultMessageEmbed
	}
	if settings.Title == "" {
		settings.Title = DefaultMessageTitleEmbed
	}

	return settings, nil
}

func ThreemaFactory(fc FactoryConfig) (NotificationChannel, error) {
	notifier, err := NewThreemaNotifier(fc)
	if err != nil {
		return nil, receiverInitError{
			Reason: err.Error(),
			Cfg:    *fc.Config,
		}
	}
	return notifier, nil
}

func NewThreemaNotifier(fc FactoryConfig) (*ThreemaNotifier, error) {
	settings, err := buildThreemaSettings(fc)
	if err != nil {
		return nil, err
	}
	return &ThreemaNotifier{
		Base: NewBase(&models.AlertNotification{
			Uid:                   fc.Config.UID,
			Name:                  fc.Config.Name,
			Type:                  fc.Config.Type,
			DisableResolveMessage: fc.Config.DisableResolveMessage,
			Settings:              fc.Config.Settings,
		}),
		log:      log.New("alerting.notifier.threema"),
		images:   fc.ImageStore,
		ns:       fc.NotificationService,
		tmpl:     fc.Template,
		settings: settings,
	}, nil
}

// Notify send an alert notification to Threema
func (tn *ThreemaNotifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	tn.log.Debug("sending threema alert notification", "from", tn.settings.GatewayID, "to", tn.settings.RecipientID)

	// Set up basic API request data
	data := url.Values{}
	data.Set("from", tn.settings.GatewayID)
	data.Set("to", tn.settings.RecipientID)
	data.Set("secret", tn.settings.APISecret)
	data.Set("text", tn.buildMessage(ctx, as...))

	cmd := &SendWebhookSettings{
		Url:        ThreemaGwBaseURL,
		Body:       data.Encode(),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
		},
	}
	if err := tn.ns.SendWebhook(ctx, cmd); err != nil {
		tn.log.Error("Failed to send threema notification", "error", err, "webhook", tn.Name)
		return false, err
	}

	return true, nil
}

func (tn *ThreemaNotifier) SendResolved() bool {
	return !tn.GetDisableResolveMessage()
}

func (tn *ThreemaNotifier) buildMessage(ctx context.Context, as ...*types.Alert) string {
	var tmplErr error
	tmpl, _ := TmplText(ctx, tn.tmpl, as, tn.log, &tmplErr)

	message := fmt.Sprintf("%s%s\n\n*Message:*\n%s\n*URL:* %s\n",
		selectEmoji(as...),
		tmpl(tn.settings.Title),
		tmpl(tn.settings.Description),
		path.Join(tn.tmpl.ExternalURL.String(), "/alerting/list"),
	)

	if tmplErr != nil {
		tn.log.Warn("failed to template Threema message", "error", tmplErr.Error())
	}

	_ = withStoredImages(ctx, tn.log, tn.images,
		func(_ int, image ngmodels.Image) error {
			if image.URL != "" {
				message += fmt.Sprintf("*Image:* %s\n", image.URL)
			}
			return nil
		}, as...)

	return message
}

func selectEmoji(as ...*types.Alert) string {
	if types.Alerts(as...).Status() == model.AlertResolved {
		return "\u2705 " // Check Mark Button
	}
	return "\u26A0\uFE0F " // Warning sign
}
