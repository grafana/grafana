package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ConditionalOutput struct {
	Conditions []ConditionChecker
	Outputter  Outputter
}

func NewConditionalOutput(conditions []ConditionChecker, outputter Outputter) *ConditionalOutput {
	return &ConditionalOutput{Conditions: conditions, Outputter: outputter}
}

func (l ConditionalOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) error {
	for _, c := range l.Conditions {
		ok, err := c.CheckCondition(ctx, frame)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
	}
	return l.Outputter.Output(ctx, vars, frame)
}
