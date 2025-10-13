package pipeline

import (
	"context"
	"fmt"
)

// RedirectDataOutput passes processing control to the rule defined
// for a configured channel.
type RedirectDataOutput struct {
	config RedirectDataOutputConfig
}

func NewRedirectDataOutput(config RedirectDataOutputConfig) *RedirectDataOutput {
	return &RedirectDataOutput{config: config}
}

const DataOutputTypeRedirect = "redirect"

func (out *RedirectDataOutput) Type() string {
	return DataOutputTypeRedirect
}

func (out *RedirectDataOutput) OutputData(_ context.Context, vars Vars, data []byte) ([]*ChannelData, error) {
	if vars.Channel == out.config.Channel {
		return nil, fmt.Errorf("redirect to the same channel: %s", out.config.Channel)
	}
	return []*ChannelData{{
		Channel: out.config.Channel,
		Data:    data,
	}}, nil
}
