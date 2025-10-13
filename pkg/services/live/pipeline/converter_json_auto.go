package pipeline

import (
	"context"
	"time"
)

type AutoJsonConverter struct {
	config      AutoJsonConverterConfig
	nowTimeFunc func() time.Time
}

func NewAutoJsonConverter(c AutoJsonConverterConfig) *AutoJsonConverter {
	return &AutoJsonConverter{config: c}
}

const ConverterTypeJsonAuto = "jsonAuto"

func (c *AutoJsonConverter) Type() string {
	return ConverterTypeJsonAuto
}

// Automatic conversion works this way:
// * Time added automatically
// * Nulls dropped
// To preserve nulls we need FieldTips from a user.
// Custom time can be injected on FrameProcessor stage theoretically.
// Custom labels can be injected on FrameProcessor stage theoretically.
func (c *AutoJsonConverter) Convert(_ context.Context, vars Vars, body []byte) ([]*ChannelFrame, error) {
	nowTimeFunc := c.nowTimeFunc
	if nowTimeFunc == nil {
		nowTimeFunc = time.Now
	}
	frame, err := jsonDocToFrame(vars.Path, body, c.config.FieldTips, nowTimeFunc)
	if err != nil {
		return nil, err
	}
	return []*ChannelFrame{
		{Channel: "", Frame: frame},
	}, nil
}
