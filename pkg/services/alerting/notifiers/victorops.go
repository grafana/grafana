package notifiers

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
)

// AlertStateCritical - Victorops uses "CRITICAL" string to indicate "Alerting" state
const AlertStateCritical = "CRITICAL"

func init() {
	alerting.RegisterNotifier("victorops", NewVictoropsNotifier)
}

// NewVictoropsNotifier creates an instance of VictoropsNotifier that
// handles posting notifications to Victorops REST API
func NewVictoropsNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find victorops url property in settings"}
	}

	return &VictoropsNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		URL:          url,
		log:          log.New("alerting.notifier.victorops"),
	}, nil
}

// VictoropsNotifier defines URL property for Victorops REST API
// and handles notification process by formatting POST body according to
// Victorops specifications (http://victorops.force.com/knowledgebase/articles/Integration/Alert-Ingestion-API-Documentation/)
type VictoropsNotifier struct {
	NotifierBase
	URL string
	log log.Logger
}

// Notify sends notification to Victorops via POST to URL endpoint
func (this *VictoropsNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing victorops notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)
	metrics.M_Alerting_Notification_Sent_Victorops.Inc(1)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed get rule link", "error", err)
		return err
	}

	fields := make([]map[string]interface{}, 0)
	fieldLimitCount := 4
	for index, evt := range evalContext.EvalMatches {
		fields = append(fields, map[string]interface{}{
			"title": evt.Metric,
			"value": evt.Value,
			"short": true,
		})
		if index > fieldLimitCount {
			break
		}
	}

	if evalContext.Error != nil {
		fields = append(fields, map[string]interface{}{
			"title": "Error message",
			"value": evalContext.Error.Error(),
			"short": false,
		})
	}

	messageType := evalContext.Rule.State
	if evalContext.Rule.State == models.AlertStateAlerting { // translate 'Alerting' to 'CRITICAL' (Victorops analog)
		messageType = AlertStateCritical
	}

	body := map[string]interface{}{
		"message_type":     messageType,
		"entity_id":        evalContext.Rule.Name,
		"timestamp":        time.Now().Unix(),
		"state_start_time": evalContext.StartTime.Unix(),
		"state_message":    evalContext.Rule.Message + "\n" + ruleUrl,
		"monitoring_tool":  "Grafana v" + setting.BuildVersion,
	}

	data, _ := json.Marshal(&body)
	cmd := &models.SendWebhookSync{Url: this.URL, Body: string(data)}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error("Failed to send victorops notification", "error", err, "webhook", this.Name)
	}

	return nil
}
