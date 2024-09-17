package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ConditionalOutput struct {
	Condition FrameConditionChecker
	Outputter FrameOutputter
}

func NewConditionalOutput(condition FrameConditionChecker, outputter FrameOutputter) *ConditionalOutput {
	return &ConditionalOutput{Condition: condition, Outputter: outputter}
}

const FrameOutputTypeConditional = "conditional"

func (out *ConditionalOutput) Type() string {
	return FrameOutputTypeConditional
}

func (out ConditionalOutput) OutputFrame(ctx context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	ok, err := out.Condition.CheckFrameCondition(ctx, frame)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	return out.Outputter.OutputFrame(ctx, vars, frame)
}
