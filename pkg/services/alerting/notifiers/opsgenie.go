package notifiers

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	sendTags    = "tags"
	sendDetails = "details"
	sendBoth    = "both"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "opsgenie",
		Name:        "OpsGenie",
		Description: "Sends notifications to OpsGenie",
		Heading:     "OpsGenie settings",
		Factory:     NewOpsGenieNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "API Key",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "OpsGenie API Key",
				PropertyName: "apiKey",
				Required:     true,
				Secure:       true,
			},
			{
				Label:        "Alert API Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "https://api.opsgenie.com/v2/alerts",
				PropertyName: "apiUrl",
				Required:     true,
			},
			{
				Label:        "Auto close incidents",
				Element:      alerting.ElementTypeCheckbox,
				Description:  "Automatically close alerts in OpsGenie once the alert goes back to ok.",
				PropertyName: "autoClose",
			}, {
				Label:        "Override priority",
				Element:      alerting.ElementTypeCheckbox,
				Description:  "Allow the alert priority to be set using the og_priority tag",
				PropertyName: "overridePriority",
			},
			{
				Label:   "Send notification tags as",
				Element: alerting.ElementTypeSelect,
				SelectOptions: []alerting.SelectOption{
					{
						Value: sendTags,
						Label: "Tags",
					},
					{
						Value: sendDetails,
						Label: "Extra Properties",
					},
					{
						Value: sendBoth,
						Label: "Tags & Extra Properties",
					},
				},
				Description:  "Send the notification tags to Opsgenie as either Extra Properties, Tags or both",
				PropertyName: "sendTagsAs",
			},
		},
	})
}

const (
	opsgenieAlertURL = "https://api.opsgenie.com/v2/alerts"
)

// NewOpsGenieNotifier is the constructor for OpsGenie.
func NewOpsGenieNotifier(model *models.AlertNotification, fn alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	autoClose := model.Settings.Get("autoClose").MustBool(true)
	overridePriority := model.Settings.Get("overridePriority").MustBool(true)
	apiKey := fn(context.Background(), model.SecureSettings, "apiKey", model.Settings.Get("apiKey").MustString(), setting.SecretKey)
	apiURL := model.Settings.Get("apiUrl").MustString()
	if apiKey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find api key property in settings"}
	}
	if apiURL == "" {
		apiURL = opsgenieAlertURL
	}

	sendTagsAs := model.Settings.Get("sendTagsAs").MustString(sendTags)
	if sendTagsAs != sendTags && sendTagsAs != sendDetails && sendTagsAs != sendBoth {
		return nil, alerting.ValidationError{
			Reason: fmt.Sprintf("Invalid value for sendTagsAs: %q", sendTagsAs),
		}
	}

	return &OpsGenieNotifier{
		NotifierBase:     NewNotifierBase(model, ns),
		APIKey:           apiKey,
		APIUrl:           apiURL,
		AutoClose:        autoClose,
		OverridePriority: overridePriority,
		SendTagsAs:       sendTagsAs,
		log:              log.New("alerting.notifier.opsgenie"),
	}, nil
}

// OpsGenieNotifier is responsible for sending
// alert notifications to OpsGenie
type OpsGenieNotifier struct {
	NotifierBase
	APIKey           string
	APIUrl           string
	AutoClose        bool
	OverridePriority bool
	SendTagsAs       string
	log              log.Logger
}

// Notify sends an alert notification to OpsGenie.
func (on *OpsGenieNotifier) Notify(evalContext *alerting.EvalContext) error {
	var err error
	switch evalContext.Rule.State {
	case models.AlertStateOK:
		if on.AutoClose {
			err = on.closeAlert(evalContext)
		}
	case models.AlertStateAlerting:
		err = on.createAlert(evalContext)
	default:
		// Handle other cases?
	}
	return err
}

func (on *OpsGenieNotifier) createAlert(evalContext *alerting.EvalContext) error {
	on.log.Info("Creating OpsGenie alert", "ruleId", evalContext.Rule.ID, "notification", on.Name)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		on.log.Error("Failed get rule link", "error", err)
		return err
	}

	customData := triggMetrString
	for _, evt := range evalContext.EvalMatches {
		customData += fmt.Sprintf("%s: %v\n", evt.Metric, evt.Value)
	}

	bodyJSON := simplejson.New()
	bodyJSON.Set("message", evalContext.Rule.Name)
	bodyJSON.Set("source", "Grafana")
	bodyJSON.Set("alias", "alertId-"+strconv.FormatInt(evalContext.Rule.ID, 10))
	bodyJSON.Set("description", fmt.Sprintf("%s - %s\n%s\n%s", evalContext.Rule.Name, ruleURL, evalContext.Rule.Message, customData))

	details := simplejson.New()
	details.Set("url", ruleURL)
	if on.NeedsImage() && evalContext.ImagePublicURL != "" {
		details.Set("image", evalContext.ImagePublicURL)
	}

	tags := make([]string, 0)
	for _, tag := range evalContext.Rule.AlertRuleTags {
		if on.sendDetails() {
			details.Set(tag.Key, tag.Value)
		}

		if on.sendTags() {
			if len(tag.Value) > 0 {
				tags = append(tags, fmt.Sprintf("%s:%s", tag.Key, tag.Value))
			} else {
				tags = append(tags, tag.Key)
			}
		}
		if tag.Key == "og_priority" {
			if on.OverridePriority {
				validPriorities := map[string]bool{"P1": true, "P2": true, "P3": true, "P4": true, "P5": true}
				if validPriorities[tag.Value] {
					bodyJSON.Set("priority", tag.Value)
				}
			}
		}
	}
	bodyJSON.Set("tags", tags)
	bodyJSON.Set("details", details)

	body, _ := bodyJSON.MarshalJSON()

	cmd := &notifications.SendWebhookSync{
		Url:        on.APIUrl,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", on.APIKey),
		},
	}

	if err := on.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		on.log.Error("Failed to send notification to OpsGenie", "error", err, "body", string(body))
	}

	return nil
}

func (on *OpsGenieNotifier) closeAlert(evalContext *alerting.EvalContext) error {
	on.log.Info("Closing OpsGenie alert", "ruleId", evalContext.Rule.ID, "notification", on.Name)

	bodyJSON := simplejson.New()
	bodyJSON.Set("source", "Grafana")
	body, _ := bodyJSON.MarshalJSON()

	cmd := &notifications.SendWebhookSync{
		Url:        fmt.Sprintf("%s/alertId-%d/close?identifierType=alias", on.APIUrl, evalContext.Rule.ID),
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", on.APIKey),
		},
	}

	if err := on.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		on.log.Error("Failed to send notification to OpsGenie", "error", err, "body", string(body))
		return err
	}

	return nil
}

func (on *OpsGenieNotifier) sendDetails() bool {
	return on.SendTagsAs == sendDetails || on.SendTagsAs == sendBoth
}

func (on *OpsGenieNotifier) sendTags() bool {
	return on.SendTagsAs == sendTags || on.SendTagsAs == sendBoth
}
