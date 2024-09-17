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

// RedirectFrameOutput passes processing control to the rule defined
// for a configured channel.
type RedirectFrameOutput struct {
	config RedirectOutputConfig
}

func NewRedirectFrameOutput(config RedirectOutputConfig) *RedirectFrameOutput {
	return &RedirectFrameOutput{config: config}
}

const FrameOutputTypeRedirect = "redirect"

func (out *RedirectFrameOutput) Type() string {
	return FrameOutputTypeRedirect
}

func (out *RedirectFrameOutput) OutputFrame(_ context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	if vars.Channel == out.config.Channel {
		return nil, fmt.Errorf("redirect to the same channel: %s", out.config.Channel)
	}
	return []*ChannelFrame{{
		Channel: out.config.Channel,
		Frame:   frame,
	}}, nil
}
