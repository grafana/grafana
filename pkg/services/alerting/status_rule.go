package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type AlertStatusCommand struct {
	Dashboard *m.Dashboard
	PanelId int64
	OrgId 	int64

	Result *EvalContext
}

func init() {
	bus.AddHandler("alerting", handleAlertStatusCommand)
}

func handleAlertStatusCommand(cmd *AlertStatusCommand) error {

	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId)

	alerts, err := extractor.GetAlerts()
	if err != nil {
		return err
	}

	for _, alert := range alerts {
		if alert.PanelId == cmd.PanelId {
			rule, err := NewRuleFromDBAlert(alert)
			if err != nil {
				return err
			}

			cmd.Result = updateState(rule)
			return nil
		}
	}

	return fmt.Errorf("Could not find alert with panel id %d", cmd.PanelId)
}

func updateState(rule *Rule) *EvalContext {
	handler := NewEvalHandler()

	context := NewEvalContext(context.Background(), rule)
	context.IsTestRun = true

	handler.Eval(context)
	context.Rule.State = context.GetNewState()

	return context
}
