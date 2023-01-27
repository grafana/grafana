package notifiers

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	threemaGwBaseURL = "https://msgapi.threema.ch/%s"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "threema",
		Name:        "Threema Gateway",
		Description: "Sends notifications to Threema using Threema Gateway (Basic IDs)",
		Heading:     "Threema Gateway settings",
		Info: "Notifications can be configured for any Threema Gateway ID of type \"Basic\". End-to-End IDs are not currently supported." +
			"The Threema Gateway ID can be set up at https://gateway.threema.ch/.",
		Factory: NewThreemaNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:          "Gateway ID",
				Element:        alerting.ElementTypeInput,
				InputType:      alerting.InputTypeText,
				Placeholder:    "*3MAGWID",
				Description:    "Your 8 character Threema Gateway Basic ID (starting with a *).",
				PropertyName:   "gateway_id",
				Required:       true,
				ValidationRule: "\\*[0-9A-Z]{7}",
			},
			{
				Label:          "Recipient ID",
				Element:        alerting.ElementTypeInput,
				InputType:      alerting.InputTypeText,
				Placeholder:    "YOUR3MID",
				Description:    "The 8 character Threema ID that should receive the alerts.",
				PropertyName:   "recipient_id",
				Required:       true,
				ValidationRule: "[0-9A-Z]{8}",
			},
			{
				Label:        "API Secret",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Your Threema Gateway API secret.",
				PropertyName: "api_secret",
				Required:     true,
				Secure:       true,
			},
		},
	})
}

// ThreemaNotifier is responsible for sending
// alert notifications to Threema.
type ThreemaNotifier struct {
	NotifierBase
	GatewayID   string
	RecipientID string
	APISecret   string
	log         log.Logger
}

// NewThreemaNotifier is the constructor for the Threema notifier
func NewThreemaNotifier(model *models.AlertNotification, fn alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	gatewayID := model.Settings.Get("gateway_id").MustString()
	recipientID := model.Settings.Get("recipient_id").MustString()
	apiSecret := fn(context.Background(), model.SecureSettings, "api_secret", model.Settings.Get("api_secret").MustString(), setting.SecretKey)

	// Validation
	if gatewayID == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Threema Gateway ID in settings"}
	}
	if !strings.HasPrefix(gatewayID, "*") {
		return nil, alerting.ValidationError{Reason: "Invalid Threema Gateway ID: Must start with a *"}
	}
	if len(gatewayID) != 8 {
		return nil, alerting.ValidationError{Reason: "Invalid Threema Gateway ID: Must be 8 characters long"}
	}
	if recipientID == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Threema Recipient ID in settings"}
	}
	if len(recipientID) != 8 {
		return nil, alerting.ValidationError{Reason: "Invalid Threema Recipient ID: Must be 8 characters long"}
	}
	if apiSecret == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Threema API secret in settings"}
	}

	return &ThreemaNotifier{
		NotifierBase: NewNotifierBase(model, ns),
		GatewayID:    gatewayID,
		RecipientID:  recipientID,
		APISecret:    apiSecret,
		log:          log.New("alerting.notifier.threema"),
	}, nil
}

// Notify send an alert notification to Threema
func (notifier *ThreemaNotifier) Notify(evalContext *alerting.EvalContext) error {
	notifier.log.Info("Sending alert notification from", "threema_id", notifier.GatewayID)
	notifier.log.Info("Sending alert notification to", "threema_id", notifier.RecipientID)

	// Set up basic API request data
	data := url.Values{}
	data.Set("from", notifier.GatewayID)
	data.Set("to", notifier.RecipientID)
	data.Set("secret", notifier.APISecret)

	// Determine emoji
	stateEmoji := ""
	switch evalContext.Rule.State {
	case models.AlertStateOK:
		stateEmoji = "\u2705 " // Check Mark Button
	case models.AlertStateNoData:
		stateEmoji = "\u2753\uFE0F " // Question Mark
	case models.AlertStateAlerting:
		stateEmoji = "\u26A0\uFE0F " // Warning sign
	default:
		// Handle other cases?
	}

	// Build message
	message := fmt.Sprintf("%s%s\n\n*State:* %s\n*Message:* %s\n",
		stateEmoji, evalContext.GetNotificationTitle(),
		evalContext.Rule.Name, evalContext.Rule.Message)
	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		message += fmt.Sprintf("*URL:* %s\n", ruleURL)
	}
	if notifier.NeedsImage() && evalContext.ImagePublicURL != "" {
		message += fmt.Sprintf("*Image:* %s\n", evalContext.ImagePublicURL)
	}
	data.Set("text", message)

	// Prepare and send request
	url := fmt.Sprintf(threemaGwBaseURL, "send_simple")
	body := data.Encode()
	headers := map[string]string{
		"Content-Type": "application/x-www-form-urlencoded",
	}
	cmd := &notifications.SendWebhookSync{
		Url:        url,
		Body:       body,
		HttpMethod: "POST",
		HttpHeader: headers,
	}
	if err := notifier.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		notifier.log.Error("Failed to send webhook", "error", err, "webhook", notifier.Name)
		return err
	}

	return nil
}
