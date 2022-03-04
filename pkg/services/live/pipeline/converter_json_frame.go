package pipeline

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// JsonFrameConverter decodes single data.Frame from JSON.
type JsonFrameConverter struct {
	config JsonFrameConverterConfig
}

func NewJsonFrameConverter(c JsonFrameConverterConfig) *JsonFrameConverter {
	return &JsonFrameConverter{
		config: c,
	}
}

const ConverterTypeJsonFrame = "jsonFrame"

func (c *JsonFrameConverter) Type() string {
	return ConverterTypeJsonFrame
}

func (c *JsonFrameConverter) Convert(_ context.Context, _ Vars, body []byte) ([]*ChannelFrame, error) {
	var frame data.Frame
	err := json.Unmarshal(body, &frame)
	if err != nil {
		return nil, err
	}
	return []*ChannelFrame{
		{Channel: "", Frame: &frame},
	}, nil
}
