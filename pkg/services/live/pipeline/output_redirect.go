package pipeline

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// RedirectOutputConfig ...
type RedirectOutputConfig struct {
	Channel string `json:"channel"`
}

// RedirectOutput passes processing control to the rule defined
// for a configured channel.
type RedirectOutput struct {
	pipeline *Pipeline
	config   RedirectOutputConfig
}

func NewRedirectOutput(pipeline *Pipeline, config RedirectOutputConfig) *RedirectOutput {
	return &RedirectOutput{pipeline: pipeline, config: config}
}

func (l *RedirectOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) error {
	if vars.Channel == l.config.Channel {
		return fmt.Errorf("redirect to the same channel: %s", l.config.Channel)
	}
	return l.pipeline.ProcessFrame(ctx, vars.OrgID, l.config.Channel, frame)
}
