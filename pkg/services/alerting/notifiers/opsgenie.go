package notifiers

import (
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
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
    `,
	})
}

var (
	opsgenieAlertURL = "https://api.opsgenie.com/v2/alerts"
)

func NewOpsGenieNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	autoClose := model.Settings.Get("autoClose").MustBool(true)
	apiKey := model.Settings.Get("apiKey").MustString()
	apiUrl := model.Settings.Get("apiUrl").MustString()
	if apiKey == "" {
		return nil, alerting.ValidationError{Reason: "Could not find api key property in settings"}
	}
	if apiUrl == "" {
		apiUrl = opsgenieAlertURL
	}

	return &OpsGenieNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		ApiKey:       apiKey,
		ApiUrl:       apiUrl,
		AutoClose:    autoClose,
		log:          log.New("alerting.notifier.opsgenie"),
	}, nil
}

type OpsGenieNotifier struct {
	NotifierBase
	ApiKey    string
	ApiUrl    string
	AutoClose bool
	log       log.Logger
}

func (this *OpsGenieNotifier) Notify(evalContext *alerting.EvalContext) error {

	var err error
	switch evalContext.Rule.State {
	case m.AlertStateOK:
		if this.AutoClose {
			err = this.closeAlert(evalContext)
		}
	case m.AlertStateAlerting:
		err = this.createAlert(evalContext)
	}
	return err
}

func (this *OpsGenieNotifier) createAlert(evalContext *alerting.EvalContext) error {
	this.log.Info("Creating OpsGenie alert", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	customData := "Triggered metrics:\n\n"
	for _, evt := range evalContext.EvalMatches {
		customData = customData + fmt.Sprintf("%s: %v\n", evt.Metric, evt.Value)
	}

	bodyJSON := simplejson.New()
	bodyJSON.Set("message", evalContext.Rule.Name)
	bodyJSON.Set("source", "Grafana")
	bodyJSON.Set("alias", "alertId-"+strconv.FormatInt(evalContext.Rule.Id, 10))
	bodyJSON.Set("description", fmt.Sprintf("%s - %s\n%s\n%s", evalContext.Rule.Name, ruleUrl, evalContext.Rule.Message, customData))

	details := simplejson.New()
	details.Set("url", ruleUrl)
	if evalContext.ImagePublicUrl != "" {
		details.Set("image", evalContext.ImagePublicUrl)
	}

	bodyJSON.Set("details", details)
	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhookSync{
		Url:        this.ApiUrl,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", this.ApiKey),
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to OpsGenie", "error", err, "body", string(body))
	}

	return nil
}

func (this *OpsGenieNotifier) closeAlert(evalContext *alerting.EvalContext) error {
	this.log.Info("Closing OpsGenie alert", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	bodyJSON := simplejson.New()
	bodyJSON.Set("source", "Grafana")
	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhookSync{
		Url:        fmt.Sprintf("%s/alertId-%d/close?identifierType=alias", this.ApiUrl, evalContext.Rule.Id),
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type":  "application/json",
			"Authorization": fmt.Sprintf("GenieKey %s", this.ApiKey),
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to OpsGenie", "error", err, "body", string(body))
		return err
	}

	return nil
}
