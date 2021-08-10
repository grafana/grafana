package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ChannelOutputConfig struct {
	Channel    string
	Conditions []ConditionChecker
}

type ChannelOutput struct {
	ruleProcessor *RuleProcessor
	config        ChannelOutputConfig
}

func NewChannelOutput(ruleProcessor *RuleProcessor, config ChannelOutputConfig) *ChannelOutput {
	return &ChannelOutput{ruleProcessor: ruleProcessor, config: config}
}

func (l ChannelOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) error {
	for _, c := range l.config.Conditions {
		ok, err := c.CheckCondition(ctx, frame)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
	}
	return l.ruleProcessor.ProcessFrame(context.Background(), vars.OrgID, l.config.Channel, frame)
}
