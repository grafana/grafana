package pipeline

import (
	"context"
)

type AutoJsonConverterConfig struct {
	FieldTips map[string]Field `json:"fieldTips"`
}

type AutoJsonConverter struct {
	config AutoJsonConverterConfig
}

func NewAutoJsonConverter(c AutoJsonConverterConfig) *AutoJsonConverter {
	return &AutoJsonConverter{config: c}
}

// Automatic conversion works this way:
// * Time added automatically
// * Nulls dropped
// To preserve nulls we need FieldTips from a user.
// Custom time can be injected on Processor stage theoretically.
// Custom labels can be injected on Processor stage theoretically.
func (c *AutoJsonConverter) Convert(_ context.Context, vars Vars, body []byte) ([]*ChannelFrame, error) {
	frame, err := JSONDocToFrame(vars.Path, body, c.config.FieldTips)
	if err != nil {
		return nil, err
	}
	return []*ChannelFrame{
		{Channel: "", Frame: frame},
	}, nil
}
