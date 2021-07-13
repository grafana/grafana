package convert

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/live/telemetry"
	"github.com/grafana/grafana/pkg/services/live/telemetry/telegraf"
)

type Converter struct {
	telegrafConverterWide         *telegraf.Converter
	telegrafConverterLabelsColumn *telegraf.Converter
	telegrafConverterPrometheus   *telegraf.Converter
}

func NewConverter() *Converter {
	return &Converter{
		telegrafConverterWide: telegraf.NewConverter(
			telegraf.WithFrameType(telegraf.FrameTypeWide),
			telegraf.WithFloat64Numbers(true),
		),
		telegrafConverterLabelsColumn: telegraf.NewConverter(
			telegraf.WithFrameType(telegraf.FrameTypeLabelsColumn),
			telegraf.WithFloat64Numbers(true),
		),
		telegrafConverterPrometheus: telegraf.NewConverter(
			telegraf.WithFrameType(telegraf.FrameTypePrometheus),
			telegraf.WithFloat64Numbers(true),
		),
	}
}

var ErrUnsupportedFrameFormat = errors.New("unsupported frame format")

func (c *Converter) Convert(data []byte, frameFormat telegraf.ConverterFrameType) ([]telemetry.FrameWrapper, error) {
	var converter telemetry.Converter
	switch frameFormat {
	case telegraf.FrameTypeWide:
		converter = c.telegrafConverterWide
	case telegraf.FrameTypeLabelsColumn:
		converter = c.telegrafConverterLabelsColumn
	case telegraf.FrameTypePrometheus:
		converter = c.telegrafConverterPrometheus
	default:
		return nil, ErrUnsupportedFrameFormat
	}

	metricFrames, err := converter.Convert(data)
	if err != nil {
		return nil, fmt.Errorf("error converting metrics: %w", err)
	}
	return metricFrames, nil
}
