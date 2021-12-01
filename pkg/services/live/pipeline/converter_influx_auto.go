package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/services/live/convert"
)

// AutoInfluxConverter decodes Influx line protocol input and transforms it
// to several ChannelFrame objects where Channel is constructed from original
// channel + / + <metric_name>.
type AutoInfluxConverter struct {
	config    AutoInfluxConverterConfig
	converter *convert.Converter
}

// NewAutoInfluxConverter creates new AutoInfluxConverter.
func NewAutoInfluxConverter(config AutoInfluxConverterConfig) *AutoInfluxConverter {
	return &AutoInfluxConverter{config: config, converter: convert.NewConverter()}
}

const ConverterTypeInfluxAuto = "influxAuto"

func (c *AutoInfluxConverter) Type() string {
	return ConverterTypeInfluxAuto
}

func (c *AutoInfluxConverter) Convert(_ context.Context, vars Vars, body []byte) ([]*ChannelFrame, error) {
	frameWrappers, err := c.converter.Convert(body, c.config.FrameFormat)
	if err != nil {
		return nil, err
	}
	channelFrames := make([]*ChannelFrame, 0, len(frameWrappers))
	for _, fw := range frameWrappers {
		channelFrames = append(channelFrames, &ChannelFrame{
			Channel: vars.Channel + "/" + fw.Key(),
			Frame:   fw.Frame(),
		})
	}
	return channelFrames, nil
}
