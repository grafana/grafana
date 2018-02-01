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
	return evalContext.Rule.State == m.AlertStateAlerting
}

func (this *AlertmanagerNotifier) Notify(evalContext *alerting.EvalContext) error {

	alerts := make([]interface{}, 0)
	for _, match := range evalContext.EvalMatches {
		alertJSON := simplejson.New()
		alertJSON.Set("startsAt", evalContext.StartTime.UTC().Format(time.RFC3339))

		if ruleUrl, err := evalContext.GetRuleUrl(); err == nil {
			alertJSON.Set("generatorURL", ruleUrl)
		}

		if evalContext.Rule.Message != "" {
			alertJSON.SetPath([]string{"annotations", "description"}, evalContext.Rule.Message)
		}

		tags := make(map[string]string)
		if len(match.Tags) == 0 {
			tags["metric"] = match.Metric
		} else {
			for k, v := range match.Tags {
				tags[k] = v
			}
		}
		tags["alertname"] = evalContext.Rule.Name
		alertJSON.Set("labels", tags)

		alerts = append(alerts, alertJSON)
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
