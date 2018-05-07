package notifiers

import (
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

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
            Instruction's for getting flow token can be found <a target="_blank" href="https://www.flowdock.com/api/integration-getting-started#/getting-started">here</a>
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

	_, err := evalContext.GetRuleUrl()
	if err != nil {
		this.log.Error("Failed to get rule link", "error", err)
		return err
	}

	return nil
}

func (this *FlowdockNotifier) getBody(evalContext *alerting.EvalContext) map[string]interface{} {
	body := map[string]interface{}{
		"event":  "activity",
		"status": this.getStatus(evalContext),
	}

	return body
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
