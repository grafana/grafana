package notifiers

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "signl4",
		Name:        "SIGNL4",
		Description: "Sends notifications to SIGNL4",
		Heading:     "SIGNL4 settings",
		Factory:     NewSignl4Notifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Team Secret",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "SIGNL4 Team Secret",
				PropertyName: "teamSecret",
				Required:     true,
				Secure:       true,
			},
			{
				Label:        "Auto close incidents",
				Element:      alerting.ElementTypeCheckbox,
				Description:  "Automatically close alerts in SIGNL4 once the alert goes back to ok.",
				PropertyName: "autoClose",
			},
			{
				Label:        "SIGNL4 Service",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Assigns the alert to the service/system category with the specified name.",
				PropertyName: "s4Service",
			},
			{
				Label:        "SIGNL4 Location",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Transmit location information ('latitude, longitude') with your event and display a map in the mobile app.",
				PropertyName: "s4Location",
			},
			{
				Label:        "SIGNL4 Alerting Scenario",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Description:  "Pass 'single_ack' if only one person needs to confirm this alert. Pass 'multi_ack' in case this alert must be confirmed by the number of people who are on duty at the time this Singl is raised.",
				PropertyName: "s4SAlertingScenario",
			},
			{
				Label:        "SIGNL4 Filtering",
				Element:      alerting.ElementTypeCheckbox,
				Description:  "Specify whether to apply event filtering for this event, or not. If set to true, the event will only trigger a notification to the team, if it contains at least one keyword from one of your services and system categories (i.e. it is whitelisted).",
				PropertyName: "s4Filtering",
			},
		},
	})
}

var (
	signl4AlertURL = "https://connect.signl4.com/webhook/"
)

// NewSignl4Notifier is the constructor for SIGNL4.
func NewSignl4Notifier(model *models.AlertNotification) (alerting.Notifier, error) {
	autoClose := model.Settings.Get("autoClose").MustBool(true)
	teamSecret := model.DecryptedValue("teamSecret", model.Settings.Get("teamSecret").MustString())
	if teamSecret == "" {
		return nil, alerting.ValidationError{Reason: "Could not find api key property in settings"}
	}
	apiURL := signl4AlertURL + teamSecret

	s4Service := model.Settings.Get("s4Service").MustString()
	s4Location := model.Settings.Get("s4Location").MustString()
	s4AlertingScenario := model.Settings.Get("s4AlertingScenario").MustString()
	s4Filtering := model.Settings.Get("s4Filtering").MustBool(false)

	return &Signl4Notifier{
		NotifierBase:       NewNotifierBase(model),
		TeamSecret:         teamSecret,
		APIUrl:             apiURL,
		AutoClose:          autoClose,
		S4Service:          s4Service,
		S4Location:         s4Location,
		S4AlertingScenario: s4AlertingScenario,
		S4Filtering:        s4Filtering,
		log:                log.New("alerting.notifier.signl4"),
	}, nil
}

// Signl4Notifier is responsible for sending
// alert notifications to SIGNL4
type Signl4Notifier struct {
	NotifierBase
	TeamSecret         string
	APIUrl             string
	AutoClose          bool
	S4Service          string
	S4Location         string
	S4AlertingScenario string
	S4Filtering        bool
	log                log.Logger
}

// Notify sends an alert notification to SIGNL4.
func (on *Signl4Notifier) Notify(evalContext *alerting.EvalContext) error {
	err := on.createAlert(evalContext)

	return err
}

func (on *Signl4Notifier) createAlert(evalContext *alerting.EvalContext) error {
	on.log.Info("Creating SIGNL4 alert", "ruleId", evalContext.Rule.ID, "notification", on.Name)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		on.log.Error("Failed get rule link", "error", err)
		return err
	}

	var status = "new"
	if evalContext.Rule.State == models.AlertStateOK {
		if on.AutoClose {
			status = "resolved"
		}
	}

	customData := triggMetrString
	for _, evt := range evalContext.EvalMatches {
		customData += fmt.Sprintf("%s: %v\n", evt.Metric, evt.Value)
	}

	bodyJSON := simplejson.New()
	bodyJSON.Set("title", evalContext.Rule.Name)
	bodyJSON.Set("source", "Grafana")
	bodyJSON.Set("description", fmt.Sprintf("%s - %s\n%s\n%s", evalContext.Rule.Name, ruleURL, evalContext.Rule.Message, customData))
	bodyJSON.Set("X-S4-Service", on.S4Service)
	bodyJSON.Set("X-S4-Location", on.S4Location)
	bodyJSON.Set("X-S4-AlertingScenario", on.S4AlertingScenario)
	bodyJSON.Set("X-S4-Filtering", on.S4Filtering)
	bodyJSON.Set("X-S4-ExternalID", "Grafana-Alert-ID-"+strconv.FormatInt(evalContext.Rule.ID, 10))
	bodyJSON.Set("X-S4-Status", status)

	details := simplejson.New()
	details.Set("url", ruleURL)
	if on.NeedsImage() && evalContext.ImagePublicURL != "" {
		details.Set("image", evalContext.ImagePublicURL)
	}

	bodyJSON.Set("details", details)

	tags := make([]string, 0)
	for _, tag := range evalContext.Rule.AlertRuleTags {
		if len(tag.Value) > 0 {
			tags = append(tags, fmt.Sprintf("%s:%s", tag.Key, tag.Value))
		} else {
			tags = append(tags, tag.Key)
		}
	}
	bodyJSON.Set("tags", tags)

	body, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        on.APIUrl,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", on.TeamSecret),
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		on.log.Error("Failed to send notification to SIGNL4", "error", err, "body", string(body))
	}

	return nil
}
