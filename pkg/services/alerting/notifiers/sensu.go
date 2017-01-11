package notifiers

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"strconv"
	"strings"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "sensu",
		Name:        "Sensu",
		Description: "Sends HTTP POST request to a Sensu API",
		Factory:     NewSensuNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Sensu settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-10">Url</span>
				<input type="text" required class="gf-form-input max-width-26" ng-model="ctrl.model.settings.url" placeholder="http://sensu-api.local:4567/results"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Username</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.username"></input>
      </div>
      <div class="gf-form">
        <span class="gf-form-label width-10">Password</span>
        <input type="text" class="gf-form-input max-width-14" ng-model="ctrl.model.settings.password"></input>
      </div>
    `,
	})

}

func NewSensuNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	return &SensuNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Url:          url,
		User:         model.Settings.Get("username").MustString(),
		Password:     model.Settings.Get("password").MustString(),
		log:          log.New("alerting.notifier.sensu"),
	}, nil
}

type SensuNotifier struct {
	NotifierBase
	Url      string
	User     string
	Password string
	log      log.Logger
}

func (this *SensuNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Sending sensu result")
	metrics.M_Alerting_Notification_Sent_Sensu.Inc(1)

	bodyJSON := simplejson.New()
	bodyJSON.Set("ruleId", evalContext.Rule.Id)
	// Sensu alerts cannot have spaces in them
	bodyJSON.Set("name", strings.Replace(evalContext.Rule.Name, " ", "_", -1))
	// Sensu alerts require a command
	// We set it to the grafana ruleID
	bodyJSON.Set("source", "grafana_rule_"+strconv.FormatInt(evalContext.Rule.Id, 10))
	// Finally, sensu expects an output
	// We set it to a default output
	bodyJSON.Set("output", "Grafana Metric Condition Met")
	bodyJSON.Set("evalMatches", evalContext.EvalMatches)

	if evalContext.Rule.State == "alerting" {
		bodyJSON.Set("status", 2)
	} else if evalContext.Rule.State == "no_data" {
		bodyJSON.Set("status", 1)
	} else {
		bodyJSON.Set("status", 0)
	}

	ruleUrl, err := evalContext.GetRuleUrl()
	if err == nil {
		bodyJSON.Set("ruleUrl", ruleUrl)
	}

	if evalContext.ImagePublicUrl != "" {
		bodyJSON.Set("imageUrl", evalContext.ImagePublicUrl)
	}

	if evalContext.Rule.Message != "" {
		bodyJSON.Set("message", evalContext.Rule.Message)
	}

	body, _ := bodyJSON.MarshalJSON()

	cmd := &m.SendWebhookSync{
		Url:        this.Url,
		User:       this.User,
		Password:   this.Password,
		Body:       string(body),
		HttpMethod: "POST",
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send sensu event", "error", err, "sensu", this.Name)
		return err
	}

	return nil
}
