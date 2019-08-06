package notifiers

import (
	"os"
	"strconv"
	"time"

	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
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
	pagerdutyEventAPIURL = "https://events.pagerduty.com/v2/enqueue"
)

// NewPagerdutyNotifier is the constructor for the PagerDuty notifier
func NewPagerdutyNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	autoResolve := model.Settings.Get("autoResolve").MustBool(false)
	key := model.Settings.Get("integrationKey").MustString()
	if key == "" {
		return nil, alerting.ValidationError{Reason: "Could not find integration key property in settings"}
	}

	return &PagerdutyNotifier{
		NotifierBase: NewNotifierBase(model),
		Key:          key,
		AutoResolve:  autoResolve,
		log:          log.New("alerting.notifier.pagerduty"),
	}, nil
}

// PagerdutyNotifier is responsible for sending
// alert notifications to pagerduty
type PagerdutyNotifier struct {
	NotifierBase
	Key         string
	AutoResolve bool
	log         log.Logger
}

// Notify sends an alert notification to PagerDuty
func (pn *PagerdutyNotifier) Notify(evalContext *alerting.EvalContext) error {

	if evalContext.Rule.State == models.AlertStateOK && !pn.AutoResolve {
		pn.log.Info("Not sending a trigger to Pagerduty", "state", evalContext.Rule.State, "auto resolve", pn.AutoResolve)
		return nil
	}

	eventType := "trigger"
	if evalContext.Rule.State == models.AlertStateOK {
		eventType = "resolve"
	}
	customData := triggMetrString
	for _, evt := range evalContext.EvalMatches {
		customData = customData + fmt.Sprintf("%s: %v\n", evt.Metric, evt.Value)
	}

	pn.log.Info("Notifying Pagerduty", "event_type", eventType)

	payloadJSON := simplejson.New()
	payloadJSON.Set("summary", evalContext.Rule.Name+" - "+evalContext.Rule.Message)
	if hostname, err := os.Hostname(); err == nil {
		payloadJSON.Set("source", hostname)
	}
	payloadJSON.Set("severity", "critical")
	payloadJSON.Set("timestamp", time.Now())
	payloadJSON.Set("component", "Grafana")
	payloadJSON.Set("custom_details", customData)

	bodyJSON := simplejson.New()
	bodyJSON.Set("routing_key", pn.Key)
	bodyJSON.Set("event_action", eventType)
	bodyJSON.Set("dedup_key", "alertId-"+strconv.FormatInt(evalContext.Rule.ID, 10))
	bodyJSON.Set("payload", payloadJSON)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		pn.log.Error("Failed get rule link", "error", err)
		return err
	}
	links := make([]interface{}, 1)
	linkJSON := simplejson.New()
	linkJSON.Set("href", ruleURL)
	bodyJSON.Set("client_url", ruleURL)
	bodyJSON.Set("client", "Grafana")
	links[0] = linkJSON
	bodyJSON.Set("links", links)

	if evalContext.ImagePublicURL != "" {
		contexts := make([]interface{}, 1)
		imageJSON := simplejson.New()
		imageJSON.Set("src", evalContext.ImagePublicURL)
		contexts[0] = imageJSON
		bodyJSON.Set("images", contexts)
	}

	body, _ := bodyJSON.MarshalJSON()

	cmd := &models.SendWebhookSync{
		Url:        pagerdutyEventAPIURL,
		Body:       string(body),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/json",
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		pn.log.Error("Failed to send notification to Pagerduty", "error", err, "body", string(body))
		return err
	}

	return nil
}
