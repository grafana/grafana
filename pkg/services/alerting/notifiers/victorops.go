package notifiers

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

// AlertStateCritical - Victorops uses "CRITICAL" string to indicate "Alerting" state
const AlertStateCritical = "CRITICAL"

// AlertStateWarning - VictorOps "WARNING" message type
const AlertStateWarning = "WARNING"
const alertStateRecovery = "RECOVERY"

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "victorops",
		Name:        "VictorOps",
		Description: "Sends notifications to VictorOps",
		Heading:     "VictorOps settings",
		Factory:     NewVictoropsNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "VictorOps url",
				PropertyName: "url",
				Required:     true,
			},
			{
				Label:        "Auto resolve incidents",
				Description:  "Resolve incidents in VictorOps once the alert goes back to ok.",
				Element:      alerting.ElementTypeCheckbox,
				PropertyName: "autoResolve",
			},
		},
	})
}

// NewVictoropsNotifier creates an instance of VictoropsNotifier that
// handles posting notifications to Victorops REST API
func NewVictoropsNotifier(model *models.AlertNotification, _ alerting.GetDecryptedValueFn, ns notifications.Service) (alerting.Notifier, error) {
	autoResolve := model.Settings.Get("autoResolve").MustBool(true)
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find victorops url property in settings"}
	}
	noDataAlertType := model.Settings.Get("noDataAlertType").MustString(AlertStateWarning)

	return &VictoropsNotifier{
		NotifierBase:    NewNotifierBase(model, ns),
		URL:             url,
		NoDataAlertType: noDataAlertType,
		AutoResolve:     autoResolve,
		log:             log.New("alerting.notifier.victorops"),
	}, nil
}

// VictoropsNotifier defines URL property for Victorops REST API
// and handles notification process by formatting POST body according to
// Victorops specifications (http://victorops.force.com/knowledgebase/articles/Integration/Alert-Ingestion-API-Documentation/)
type VictoropsNotifier struct {
	NotifierBase
	URL             string
	NoDataAlertType string
	AutoResolve     bool
	log             log.Logger
}

func (vn *VictoropsNotifier) buildEventPayload(evalContext *alerting.EvalContext) (*simplejson.Json, error) {
	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		vn.log.Error("Failed get rule link", "error", err)
		return nil, err
	}

	if evalContext.Rule.State == models.AlertStateOK && !vn.AutoResolve {
		vn.log.Info("Not alerting VictorOps", "state", evalContext.Rule.State, "auto resolve", vn.AutoResolve)
		return nil, nil
	}

	messageType := AlertStateCritical // Default to alerting and change based on state checks (Ensures string type)
	for _, tag := range evalContext.Rule.AlertRuleTags {
		if strings.ToLower(tag.Key) == "severity" {
			// Only set severity if it's one of the PD supported enum values
			// Info, Warning, Error, or Critical (case insensitive)
			switch sev := strings.ToUpper(tag.Value); sev {
			case "INFO":
				fallthrough
			case "WARNING":
				fallthrough
			case "CRITICAL":
				messageType = sev
			default:
				vn.log.Warn("Ignoring invalid severity tag", "severity", sev)
			}
		}
	}

	if evalContext.Rule.State == models.AlertStateNoData { // translate 'NODATA' to set alert
		messageType = vn.NoDataAlertType
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

	return bodyJSON, nil
}

// Notify sends notification to Victorops via POST to URL endpoint
func (vn *VictoropsNotifier) Notify(evalContext *alerting.EvalContext) error {
	vn.log.Info("Executing victorops notification", "ruleId", evalContext.Rule.ID, "notification", vn.Name)

	bodyJSON, err := vn.buildEventPayload(evalContext)
	if err != nil {
		return err
	}

	data, _ := bodyJSON.MarshalJSON()
	cmd := &notifications.SendWebhookSync{Url: vn.URL, Body: string(data)}

	if err := vn.NotificationService.SendWebhookSync(evalContext.Ctx, cmd); err != nil {
		vn.log.Error("Failed to send Victorops notification", "error", err, "webhook", vn.Name)
		return err
	}

	return nil
}
