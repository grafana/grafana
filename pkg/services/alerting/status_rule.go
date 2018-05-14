package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type AlertStatusCommand struct {
	Alert   *m.Alert

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

	return fmt.Errorf("could not find alert with panel id %d", cmd.Alert.PanelId)
}

func updateState(rule *Rule) *EvalContext {
	handler := NewEvalHandler()

	evalContext := NewEvalContext(context.Background(), rule)
	evalContext.IsTestRun = true

	handler.Eval(evalContext)
	evalContext.Rule.State = evalContext.GetNewState()

	return evalContext
}
