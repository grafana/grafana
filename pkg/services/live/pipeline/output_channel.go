package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ChannelOutputConfig struct {
	Channel string `json:"channel"`
}

type ChannelOutput struct {
	pipeline *Pipeline
	config   ChannelOutputConfig
}

func NewChannelOutput(pipeline *Pipeline, config ChannelOutputConfig) *ChannelOutput {
	return &ChannelOutput{pipeline: pipeline, config: config}
}

func (l ChannelOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) error {
	return l.pipeline.ProcessFrame(ctx, vars.OrgID, l.config.Channel, frame)
}
