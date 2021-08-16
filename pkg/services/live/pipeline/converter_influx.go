package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/services/live/convert"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type InfluxConverterConfig struct {
	FrameFormat  string
	FrameChannel string
}

type InfluxConverter struct {
	config    InfluxConverterConfig
	converter *convert.Converter
}

func NewInfluxConverter(config InfluxConverterConfig) *InfluxConverter {
	return &InfluxConverter{config: config, converter: convert.NewConverter()}
}

func (i InfluxConverter) Convert(_ context.Context, _ Vars, body []byte) ([]*data.Frame, error) {
	return i.converter.Convert(body, i.config.FrameFormat, i.config.FrameChannel)
}
