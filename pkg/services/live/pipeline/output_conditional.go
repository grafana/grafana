package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ConditionalOutput struct {
	Condition ConditionChecker
	Outputter Outputter
}

func NewConditionalOutput(condition ConditionChecker, outputter Outputter) *ConditionalOutput {
	return &ConditionalOutput{Condition: condition, Outputter: outputter}
}

func (l ConditionalOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) ([]*ChannelFrame, error) {
	ok, err := l.Condition.CheckCondition(ctx, frame)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	return l.Outputter.Output(ctx, vars, frame)
}
