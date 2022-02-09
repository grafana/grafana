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
}

func NewConverter() *Converter {
	return &Converter{
		telegrafConverterWide: telegraf.NewConverter(
			telegraf.WithFloat64Numbers(true),
		),
		telegrafConverterLabelsColumn: telegraf.NewConverter(
			telegraf.WithUseLabelsColumn(true),
			telegraf.WithFloat64Numbers(true),
		),
	}
}

var ErrUnsupportedFrameFormat = errors.New("unsupported frame format")

func (c *Converter) Convert(data []byte, frameFormat string) ([]telemetry.FrameWrapper, error) {
	var converter telemetry.Converter
	switch frameFormat {
	case "wide":
		converter = c.telegrafConverterWide
	case "labels_column":
		converter = c.telegrafConverterLabelsColumn
	default:
		return nil, ErrUnsupportedFrameFormat
	}

	metricFrames, err := converter.Convert(data)
	if err != nil {
		return nil, fmt.Errorf("error converting metrics: %w", err)
	}
	return metricFrames, nil
}
