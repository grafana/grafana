package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type AlertStatusCommand struct {
	Alert  *m.Alert

	Result *EvalContext
}

func init() {
	bus.AddHandler("alerting", handleAlertStatusCommand)
}

func handleAlertStatusCommand(cmd *AlertStatusCommand) error {

	rule, err := NewRuleFromDBAlert(cmd.Alert)
	if err != nil {
		return err
	}

	cmd.Result = updateState(rule)
	return nil
}

func updateState(rule *Rule) *EvalContext {
	handler := NewEvalHandler()

	evalContext := NewEvalContext(context.Background(), rule)

	handler.Eval(evalContext)
	evalContext.Rule.State = evalContext.GetNewState()

	return evalContext
}
