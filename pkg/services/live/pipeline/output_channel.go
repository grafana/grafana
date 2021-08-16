package pipeline

import (
	"context"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ChannelOutputConfig struct {
	Channel string
}

type ChannelOutput struct {
	ruleProcessor *RuleProcessor
	config        ChannelOutputConfig
}

func NewChannelOutput(ruleProcessor *RuleProcessor, config ChannelOutputConfig) *ChannelOutput {
	return &ChannelOutput{ruleProcessor: ruleProcessor, config: config}
}

func (l ChannelOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) error {
	channel := l.config.Channel
	if frame.Meta != nil {
		channel = strings.ReplaceAll(channel, "#{frame_channel}", frame.Meta.Channel)
	}
	return l.ruleProcessor.ProcessFrame(ctx, vars.OrgID, channel, frame)
}
