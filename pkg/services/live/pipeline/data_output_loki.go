package pipeline

import (
	"context"
	"net/http"
	"time"
)

// LokiDataOutputConfig ...
type LokiDataOutputConfig struct{}

// LokiDataOutput passes processing control to the rule defined
// for a configured channel.
type LokiDataOutput struct {
	config     LokiDataOutputConfig
	httpClient *http.Client
}

func NewLokiDataOutput(config LokiDataOutputConfig) *LokiDataOutput {
	return &LokiDataOutput{
		config:     config,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}
}

const DataOutputTypeLoki = "loki"

func (out *LokiDataOutput) Type() string {
	return DataOutputTypeLoki
}

func (out *LokiDataOutput) OutputData(_ context.Context, vars Vars, data []byte) ([]*ChannelData, error) {
	return nil, outputLoki(out.httpClient, string(data), map[string]string{"raw": "test"})
}
