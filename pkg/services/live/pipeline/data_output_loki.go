package pipeline

import (
	"context"
	"time"
)

// LokiDataOutputConfig ...
type LokiDataOutputConfig struct{}

// LokiDataOutput passes processing control to the rule defined
// for a configured channel.
type LokiDataOutput struct {
	config     LokiDataOutputConfig
	lokiWriter *lokiWriter
}

func NewLokiDataOutput(config LokiDataOutputConfig) *LokiDataOutput {
	return &LokiDataOutput{
		config:     config,
		lokiWriter: newLokiWriter(),
	}
}

const DataOutputTypeLoki = "loki"

func (out *LokiDataOutput) Type() string {
	return DataOutputTypeLoki
}

func (out *LokiDataOutput) OutputData(_ context.Context, vars Vars, data []byte) ([]*ChannelData, error) {
	err := out.lokiWriter.write(LokiStream{
		Stream: map[string]string{"channel": vars.Channel},
		Values: []interface{}{
			[]interface{}{time.Now().UnixNano(), string(data)},
		},
	})
	return nil, err
}
