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
      <div class="gf-form">
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
	}, nil
}

type FlowdockNotifier struct {
	NotifierBase
}

func (this *FlowdockNotifier) Notify(evalContext *alerting.EvalContext) error {
	return nil
}
