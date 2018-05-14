package notifiers

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

const FlowdockMessageUrl = "https://api.flowdock.com/messages"

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "flowdock",
		Name:        "Flowdock",
		Description: "Sends notifications to Flowdock",
		Factory:     NewFlowdockNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Flowdock settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Flow token</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.flowToken" placeholder="Flowdock flow token"></input>
        <info-popover mode="right-absolute">
            Instructions for getting the flow token can be found <a target="_blank" href="https://www.flowdock.com/api/integration-getting-started#/getting-started">here</a>
        </info-popover>
      </div>
    `,
	})
}

func NewFlowdockNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	flowToken := model.Settings.Get("flowToken").MustString()
	if flowToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find flowToken in settings"}
	}

	return &FlowdockNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		FlowToken:    flowToken,
		log:          log.New("alerting.notifier.flowdock"),
	}, nil
}

type FlowdockNotifier struct {
	NotifierBase
	FlowToken string
	log       log.Logger
}

func (this *FlowdockNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing Flowdock notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)
	body := this.getBody(evalContext)
	body["flow_token"] = this.FlowToken

	data, _ := json.Marshal(&body)
	cmd := &models.SendWebhookSync{
		Url:        FlowdockMessageUrl,
		Body:       string(data),
		HttpMethod: "POST",
		HttpHeader: map[string]string{
			"Content-Type": "application/json",
		},
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		this.log.Error(
			"Failed to send notification to Flowdock", "error", err,
			"webhook", this.Name, "body", string(data),
		)
		return err
	}
	return nil
}

func (this *FlowdockNotifier) getBody(evalContext *alerting.EvalContext) map[string]interface{} {
	return map[string]interface{}{
		"event":              "activity",
		"thread":             this.getThread(evalContext),
		"author":             this.getAuthor(evalContext),
		"title":              evalContext.GetNotificationTitle(),
		"external_thread_id": this.combineStartTimeAndRuleId(evalContext),
	}
}

func (this *FlowdockNotifier) getThread(evalContext *alerting.EvalContext) map[string]interface{} {
	ruleUrl, _ := evalContext.GetRuleUrl()

	return map[string]interface{}{
		"title":        evalContext.GetNotificationTitle(),
		"status":       this.getStatus(evalContext),
		"fields":       this.getFields(evalContext),
		"external_url": ruleUrl,
		"body":         `<img src="` + evalContext.ImagePublicUrl + `">`,
	}
}

func (this *FlowdockNotifier) getStatus(evalContext *alerting.EvalContext) map[string]string {
	switch evalContext.Rule.State {
	case models.AlertStateAlerting:
		return map[string]string{
			"color": "red",
			"value": "Alerting",
		}
	case models.AlertStateOK:
		return map[string]string{
			"color": "green",
			"value": "Ok",
		}
	case models.AlertStateNoData:
		return map[string]string{
			"color": "yellow",
			"value": "No data",
		}
	default:
		return map[string]string{
			"color": "blue",
			"value": "Unknown value",
		}
	}
}

func (this *FlowdockNotifier) getFields(evalContext *alerting.EvalContext) []map[string]string {
	fields := make([]map[string]string, 0)
	for _, evalMatch := range evalContext.EvalMatches {
		fields = append(fields, map[string]string{
			"label": evalMatch.Metric,
			"value": evalMatch.Value.String(),
		})
	}
	return fields
}

func (this *FlowdockNotifier) getAuthor(evalContext *alerting.EvalContext) map[string]string {
	return map[string]string{
		"name":   "Grafana",
		"avatar": "https://grafana.com/assets/img/fav32.png",
	}
}

func (this *FlowdockNotifier) combineStartTimeAndRuleId(evalContext *alerting.EvalContext) string {
	startTime := evalContext.StartTime
	beginningOfDay := time.Date(
		startTime.Year(), startTime.Month(), startTime.Day(),
		0, 0, 0, 0, startTime.Location())

	ruleId := evalContext.Rule.Id

	return fmt.Sprintf("%d", (ruleId + beginningOfDay.Unix()))
}
