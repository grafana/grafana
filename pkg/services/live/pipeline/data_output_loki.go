package pipeline

import (
	"context"
	"time"
)

// LokiDataOutput can output raw data to Loki (as string value).
type LokiDataOutput struct {
	lokiWriter *lokiWriter
}

func NewLokiDataOutput(endpoint string, basicAuth *BasicAuth) *LokiDataOutput {
	return &LokiDataOutput{
		lokiWriter: newLokiWriter(endpoint, basicAuth),
	}
}

const DataOutputTypeLoki = "loki"

func (out *LokiDataOutput) Type() string {
	return DataOutputTypeLoki
}

func (out *LokiDataOutput) OutputData(_ context.Context, vars Vars, data []byte) ([]*ChannelData, error) {
	if out.lokiWriter.endpoint == "" {
		logger.Debug("Skip sending to Loki: no url")
		return nil, nil
	}
	err := out.lokiWriter.write(LokiStream{
		Stream: map[string]string{"channel": vars.Channel},
		Values: []interface{}{
			[]interface{}{time.Now().UnixNano(), string(data)},
		},
	})
	return nil, err
}
