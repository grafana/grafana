package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ChannelOutputConfig struct {
	Channel string `json:"channel"`
}

type ChannelOutput struct {
	ruleProcessor *RuleProcessor
	config        ChannelOutputConfig
}

func NewChannelOutput(ruleProcessor *RuleProcessor, config ChannelOutputConfig) *ChannelOutput {
	return &ChannelOutput{ruleProcessor: ruleProcessor, config: config}
}

func (l ChannelOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) error {
	return l.ruleProcessor.ProcessFrame(ctx, vars.OrgID, l.config.Channel, frame)
}
