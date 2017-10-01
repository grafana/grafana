package notifiers

import (
	"strconv"

	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "pagerduty",
		Name:        "PagerDuty",
		Description: "Sends notifications to PagerDuty",
		Factory:     NewPagerdutyNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">PagerDuty settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-14">Integration Key</span>
        <input type="text" required class="gf-form-input max-width-22" ng-model="ctrl.model.settings.integrationKey" placeholder="Pagerduty Integration Key"></input>
      </div>
      <div class="gf-form">
        <gf-form-switch
           class="gf-form"
           label="Auto resolve incidents"
           label-class="width-14"
           checked="ctrl.model.settings.autoResolve"
           tooltip="Resolve incidents in pagerduty once the alert goes back to ok.">
        </gf-form-switch>
      </div>
    `,
	})
}

var (
	pagerdutyEventApiUrl string = "https://events.pagerduty.com/generic/2010-04-15/create_event.json"
)

func NewPagerdutyNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	autoResolve := model.Settings.Get("autoResolve").MustBool(true)
	key := model.Settings.Get("integrationKey").MustString()
	if key == "" {
		return nil, alerting.ValidationError{Reason: "Could not find integration key property in settings"}
	}

	return &PagerdutyNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Key:          key,
		AutoResolve:  autoResolve,
		log:          log.New("alerting.notifier.pagerduty"),
	}, nil
}

type PagerdutyNotifier struct {
	NotifierBase
	Key         string
	AutoResolve bool
	log         log.Logger
}

func (this *PagerdutyNotifier) Notify(evalContext *alerting.EvalContext) error {

	if evalContext.Rule.State == m.AlertStateOK && !this.AutoResolve {
		this.log.Info("Not sending a trigger to Pagerduty", "state", evalContext.Rule.State, "auto resolve", this.AutoResolve)
		return nil
	}

	eventType := "trigger"
	if evalContext.Rule.State == m.AlertStateOK {
		eventType = "resolve"
	}
	customData := "Triggered metrics:\n\n"
	for _, evt := range evalContext.EvalMatches {
		customData = customData + fmt.Sprintf("%s: %v\n", evt.Metric, evt.Value)
	}

	this.log.Info("Notifying Pagerduty", "event_type", eventType)

	bodyJSON := simplejson.New()
	bodyJSON.Set("service_key", this.Key)
	bodyJSON.Set("description", evalContext.Rule.Name+" - "+evalContext.Rule.Message)
	bodyJSON.Set("client", "Grafana")
	bodyJSON.Set("details", customData)
	bodyJSON.Set("event_type", eventType)
	bodyJSON.Set("incident_key", "alertId-"+strconv.FormatInt(evalContext.Rule.Id, 10))

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}
	bodyJSON.Set("client_url", ruleUrl)

	if evalContext.ImagePublicUrl != "" {
		contexts := make([]interface{}, 1)
		imageJSON := simplejson.New()
		imageJSON.Set("type", "image")
		imageJSON.Set("src", evalContext.ImagePublicUrl)
		contexts[0] = imageJSON
		bodyJSON.Set("contexts", contexts)
	}

	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhookSync{
		Url:        pagerdutyEventApiUrl,
		Body:       string(body),
		HttpMethod: "POST",
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send notification to Pagerduty", "error", err, "body", string(body))
		return err
	}

	return nil
}
