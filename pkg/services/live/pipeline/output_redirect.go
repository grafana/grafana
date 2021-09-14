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
	config RedirectOutputConfig
}

func NewRedirectOutput(config RedirectOutputConfig) *RedirectOutput {
	return &RedirectOutput{config: config}
}

func (l *RedirectOutput) Output(_ context.Context, vars OutputVars, frame *data.Frame) ([]*ChannelFrame, error) {
	if vars.Channel == l.config.Channel {
		return nil, fmt.Errorf("redirect to the same channel: %s", l.config.Channel)
	}
	return []*ChannelFrame{{
		Channel: l.config.Channel,
		Frame:   frame,
	}}, nil
}
