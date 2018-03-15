package notifiers

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "prometheus-alertmanager",
		Name:        "Prometheus Alertmanager",
		Description: "Sends alert to Prometheus Alertmanager",
		Factory:     NewAlertmanagerNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Alertmanager settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Url</span>
        <input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.url" placeholder="http://localhost:9093"></input>
      </div>
    `,
	})
}

func NewAlertmanagerNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &AlertmanagerNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Url:          url,
		log:          log.New("alerting.notifier.prometheus-alertmanager"),
	}, nil
}

type AlertmanagerNotifier struct {
	NotifierBase
	Url string
	log log.Logger
}

func (this *AlertmanagerNotifier) ShouldNotify(evalContext *alerting.EvalContext) bool {
	this.log.Debug("Should notify", "ruleId", evalContext.Rule.Id, "state", evalContext.Rule.State, "previousState", evalContext.PrevAlertState)

	// Do not notify when we become OK for the first time.
	if (evalContext.PrevAlertState == m.AlertStatePending) && (evalContext.Rule.State == m.AlertStateOK) {
		return false
	}
	// Notify on Alerting -> OK to resolve before alertmanager timeout.
	if (evalContext.PrevAlertState == m.AlertStateAlerting) && (evalContext.Rule.State == m.AlertStateOK) {
		return true
	}
	return evalContext.Rule.State == m.AlertStateAlerting
}

func (this *AlertmanagerNotifier) createAlert(evalContext *alerting.EvalContext, match *alerting.EvalMatch, ruleUrl string) *simplejson.Json {
	alertJSON := simplejson.New()
	alertJSON.Set("startsAt", evalContext.StartTime.UTC().Format(time.RFC3339))
	if evalContext.Rule.State == m.AlertStateOK {
		alertJSON.Set("endsAt", time.Now().UTC().Format(time.RFC3339))
	}
	alertJSON.Set("generatorURL", ruleUrl)

	// Annotations (summary and description are very commonly used).
	alertJSON.SetPath([]string{"annotations", "summary"}, evalContext.Rule.Name)
	description := ""
	if evalContext.Rule.Message != "" {
		description += evalContext.Rule.Message
	}
	if evalContext.Error != nil {
		if description != "" {
			description += "\n"
		}
		description += "Error: " + evalContext.Error.Error()
	}
	if description != "" {
		alertJSON.SetPath([]string{"annotations", "description"}, description)
	}
	if evalContext.ImagePublicUrl != "" {
		alertJSON.SetPath([]string{"annotations", "image"}, evalContext.ImagePublicUrl)
	}

	// Labels (from metrics tags + mandatory alertname).
	tags := make(map[string]string)
	if match != nil {
		if len(match.Tags) == 0 {
			tags["metric"] = match.Metric
		} else {
			for k, v := range match.Tags {
				tags[k] = v
			}
		}
	}
	tags["alertname"] = evalContext.Rule.Name
	alertJSON.Set("labels", tags)
	return alertJSON
}

func (this *AlertmanagerNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending Alertmanager alert", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	// Send one alert per matching series.
	alerts := make([]interface{}, 0)
	for _, match := range evalContext.EvalMatches {
		alert := this.createAlert(evalContext, match, ruleUrl)
		alerts = append(alerts, alert)
	}

	// This happens on ExecutionError or NoData
	if len(alerts) == 0 {
		alert := this.createAlert(evalContext, nil, ruleUrl)
		alerts = append(alerts, alert)
	}

	bodyJSON := simplejson.NewFromAny(alerts)
	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhookSync{
		Url:        this.Url + "/api/v1/alerts",
		HttpMethod: "POST",
		Body:       string(body),
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send alertmanager", "error", err, "alertmanager", this.Name)
		return err
	}

	return nil
}
