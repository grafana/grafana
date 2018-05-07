package notifiers

import (
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
	}, nil
}

type FlowdockNotifier struct {
	NotifierBase
	FlowToken string
}

func (this *FlowdockNotifier) Notify(evalContext *alerting.EvalContext) error {
	return nil
}
