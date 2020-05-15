package notifiers

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

// AlertStateCritical - Victorops uses "CRITICAL" string to indicate "Alerting" state
const AlertStateCritical = "CRITICAL"

const alertStateRecovery = "RECOVERY"

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "victorops",
		Name:        "VictorOps",
		Description: "Sends notifications to VictorOps",
		Factory:     NewVictoropsNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">VictorOps settings</h3>
      <div class="gf-form">
        <span class="gf-form-label width-6">Url</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="VictorOps url"></input>
      </div>
      <div class="gf-form">
        <gf-form-switch
           class="gf-form"
           label="Auto resolve incidents"
           label-class="width-14"
           checked="ctrl.model.settings.autoResolve"
           tooltip="Resolve incidents in VictorOps once the alert goes back to ok.">
        </gf-form-switch>
      </div>
    `,
	})
}

// NewVictoropsNotifier creates an instance of VictoropsNotifier that
// handles posting notifications to Victorops REST API
func NewVictoropsNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	autoResolve := model.Settings.Get("autoResolve").MustBool(true)
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find victorops url property in settings"}
	}

	return &VictoropsNotifier{
		NotifierBase: NewNotifierBase(model),
		URL:          url,
		AutoResolve:  autoResolve,
		log:          log.New("alerting.notifier.victorops"),
	}, nil
}

// VictoropsNotifier defines URL property for Victorops REST API
// and handles notification process by formatting POST body according to
// Victorops specifications (http://victorops.force.com/knowledgebase/articles/Integration/Alert-Ingestion-API-Documentation/)
type VictoropsNotifier struct {
	NotifierBase
	URL         string
	AutoResolve bool
	log         log.Logger
}

// Notify sends notification to Victorops via POST to URL endpoint
func (vn *VictoropsNotifier) Notify(evalContext *alerting.EvalContext) error {
	vn.log.Info("Executing victorops notification", "ruleId", evalContext.Rule.ID, "notification", vn.Name)

	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		vn.log.Error("Failed get rule link", "error", err)
		return err
	}

	if evalContext.Rule.State == models.AlertStateOK && !vn.AutoResolve {
		vn.log.Info("Not alerting VictorOps", "state", evalContext.Rule.State, "auto resolve", vn.AutoResolve)
		return nil
	}

	messageType := evalContext.Rule.State
	if evalContext.Rule.State == models.AlertStateAlerting { // translate 'Alerting' to 'CRITICAL' (Victorops analog)
		messageType = AlertStateCritical
	}

	if evalContext.Rule.State == models.AlertStateOK {
		messageType = alertStateRecovery
	}

	fields := make(map[string]interface{})
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		fields[evt.Metric] = evt.Value
		if index > fieldLimitCount {
			break
		}
	}

	bodyJSON := simplejson.New()
	bodyJSON.Set("message_type", messageType)
	bodyJSON.Set("entity_id", evalContext.Rule.Name)
	bodyJSON.Set("entity_display_name", evalContext.GetNotificationTitle())
	bodyJSON.Set("timestamp", time.Now().Unix())
	bodyJSON.Set("state_start_time", evalContext.StartTime.Unix())
	bodyJSON.Set("state_message", evalContext.Rule.Message)
	bodyJSON.Set("monitoring_tool", "Grafana v"+setting.BuildVersion)
	bodyJSON.Set("alert_url", ruleURL)
	bodyJSON.Set("metrics", fields)

	if evalContext.Error != nil {
		bodyJSON.Set("error_message", evalContext.Error.Error())
	}

	if vn.NeedsImage() && evalContext.ImagePublicURL != "" {
		bodyJSON.Set("image_url", evalContext.ImagePublicURL)
	}

	data, _ := bodyJSON.MarshalJSON()
	cmd := &models.SendWebhookSync{Url: vn.URL, Body: string(data)}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		vn.log.Error("Failed to send Victorops notification", "error", err, "webhook", vn.Name)
		return err
	}

	return nil
}
