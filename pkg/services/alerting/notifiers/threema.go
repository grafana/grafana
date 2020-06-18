package notifiers

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

var (
	threemaGwBaseURL = "https://msgapi.threema.ch/%s"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "threema",
		Name:        "Threema Gateway",
		Description: "Sends notifications to Threema using the Threema Gateway",
		Heading:     "Threema Gateway settings",
		Info: "Notifications can be configured for any Threema Gateway ID of type \"Basic\". End-to-End IDs are not currently supported." +
			"The Threema Gateway ID can be set up at https://gateway.threema.ch/.",
		Factory: NewThreemaNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Threema Gateway settings</h3>
      <p>
        Notifications can be configured for any Threema Gateway ID of type
        "Basic". End-to-End IDs are not currently supported.
      </p>
      <p>
        The Threema Gateway ID can be set up at
        <a href="https://gateway.threema.ch/" target="_blank" rel="noopener noreferrer">https://gateway.threema.ch/</a>.
      </p>
      <div class="gf-form">
        <span class="gf-form-label width-14">Gateway ID</span>
        <input type="text" required maxlength="8" pattern="\*[0-9A-Z]{7}"
          class="gf-form-input max-width-14"
          ng-model="ctrl.model.settings.gateway_id"
          placeholder="*3MAGWID">
        </input>
        <info-popover mode="right-normal">
          Your 8 character Threema Gateway ID (starting with a *)
        </info-popover>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-14">Recipient ID</span>
        <input type="text" required maxlength="8" pattern="[0-9A-Z]{8}"
          class="gf-form-input max-width-14"
          ng-model="ctrl.model.settings.recipient_id"
          placeholder="YOUR3MID">
        </input>
        <info-popover mode="right-normal">
          The 8 character Threema ID that should receive the alerts
        </info-popover>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-14">API Secret</span>
        <input type="text" required
          class="gf-form-input max-width-24"
          ng-model="ctrl.model.settings.api_secret">
        </input>
        <info-popover mode="right-normal">
          Your Threema Gateway API secret
        </info-popover>
      </div>
    `,
		Options: []alerting.NotifierOption{
			{
				Label:          "Gateway ID",
				Element:        alerting.ElementTypeInput,
				InputType:      alerting.InputTypeText,
				Placeholder:    "*3MAGWID",
				Description:    "Your 8 character Threema Gateway ID (starting with a *).",
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
func NewThreemaNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	if model.Settings == nil {
		return nil, alerting.ValidationError{Reason: "No Settings Supplied"}
	}

	gatewayID := model.Settings.Get("gateway_id").MustString()
	recipientID := model.Settings.Get("recipient_id").MustString()
	apiSecret := model.Settings.Get("api_secret").MustString()

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
		NotifierBase: NewNotifierBase(model),
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
	}

	// Build message
	message := fmt.Sprintf("%s%s\n\n*State:* %s\n*Message:* %s\n",
		stateEmoji, evalContext.GetNotificationTitle(),
		evalContext.Rule.Name, evalContext.Rule.Message)
	ruleURL, err := evalContext.GetRuleURL()
	if err == nil {
		message = message + fmt.Sprintf("*URL:* %s\n", ruleURL)
	}
	if notifier.NeedsImage() && evalContext.ImagePublicURL != "" {
		message = message + fmt.Sprintf("*Image:* %s\n", evalContext.ImagePublicURL)
	}
	data.Set("text", message)

	// Prepare and send request
	url := fmt.Sprintf(threemaGwBaseURL, "send_simple")
	body := data.Encode()
	headers := map[string]string{
		"Content-Type": "application/x-www-form-urlencoded",
	}
	cmd := &models.SendWebhookSync{
		Url:        url,
		Body:       body,
		HttpMethod: "POST",
		HttpHeader: headers,
	}
	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		notifier.log.Error("Failed to send webhook", "error", err, "webhook", notifier.Name)
		return err
	}

	return nil
}
