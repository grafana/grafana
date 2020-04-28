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
		Type:        "opsgenie",
		Name:        "OpsGenie",
		Description: "Sends notifications to OpsGenie",
		Factory:     NewOpsGenieNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">OpsGenie settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-14">API Key</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.apiKey" placeholder="OpsGenie API Key"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-14">Alert API Url</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.apiUrl" placeholder="https://api.opsgenie.com/v2/alerts"></input>
      </div>
      <div class="gf-form">
        <gf-form-switch
           class="gf-form"
           label="Auto close incidents"
           label-class="width-14"
           checked="ctrl.model.settings.autoClose"
           tooltip="Automatically close alerts in OpsGenie once the alert goes back to ok.">
        </gf-form-switch>
      </div>
      <div class="gf-form">
        <gf-form-switch
           class="gf-form"
           label="Override priority"
           label-class="width-14"
           checked="ctrl.model.settings.overridePriority"
           tooltip="Allow the alert priority to be set using the og_priority tag">
        </gf-form-switch>
  </div>
`,
	})
}

var (
	opsgenieAlertURL = "https://api.opsgenie.com/v2/alerts"
)

// NewOpsGenieNotifier is the constructor for OpsGenie.
func NewOpsGenieNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	autoClose := model.Settings.Get("autoClose").MustBool(true)
	overridePriority := model.Settings.Get("overridePriority").MustBool(true)
	apiKey := model.Settings.Get("apiKey").MustString()
	apiURL := model.Settings.Get("apiUrl").MustString()
	if apiKey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find api key property in settings"}
	}
	if apiURL == "" {
		apiURL = opsgenieAlertURL
	}

	return &OpsGenieNotifier{
		NotifierBase:     NewNotifierBase(model),
		APIKey:           apiKey,
		APIUrl:           apiURL,
		AutoClose:        autoClose,
		OverridePriority: overridePriority,
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
		customData = customData + fmt.Sprintf("%s: %v\n", evt.Metric, evt.Value)
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

	bodyJSON.Set("details", details)

	tags := make([]string, 0)
	for _, tag := range evalContext.Rule.AlertRuleTags {
		if len(tag.Value) > 0 {
			tags = append(tags, fmt.Sprintf("%s:%s", tag.Key, tag.Value))
		} else {
			tags = append(tags, tag.Key)
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

	body, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        on.APIUrl,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", on.APIKey),
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		on.log.Error("Failed to send notification to OpsGenie", "error", err, "body", string(body))
	}

	return nil
}

func (on *OpsGenieNotifier) closeAlert(evalContext *alerting.EvalContext) error {
	on.log.Info("Closing OpsGenie alert", "ruleId", evalContext.Rule.ID, "notification", on.Name)

	bodyJSON := simplejson.New()
	bodyJSON.Set("source", "Grafana")
	body, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        fmt.Sprintf("%s/alertId-%d/close?identifierType=alias", on.APIUrl, evalContext.Rule.ID),
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", on.APIKey),
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		on.log.Error("Failed to send notification to OpsGenie", "error", err, "body", string(body))
		return err
	}

	return nil
}
