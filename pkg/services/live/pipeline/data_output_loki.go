package pipeline

import (
	"context"
	"time"
)

// LokiDataOutput passes processing control to the rule defined
// for a configured channel.
type LokiDataOutput struct {
	lokiWriter *lokiWriter
}

func NewLokiDataOutput(endpoint, user, password string) *LokiDataOutput {
	return &LokiDataOutput{
		lokiWriter: newLokiWriter(endpoint, user, password),
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
