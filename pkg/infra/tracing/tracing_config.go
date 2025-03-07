package tracing

import (
	"fmt"

	"go.opentelemetry.io/otel/attribute"
)

type TracingConfig struct {
	Enabled       string
	Address       string
	Propagation   string
	CustomAttribs []attribute.KeyValue

	Sampler          string
	SamplerParam     float64
	SamplerRemoteURL string

	ServiceName    string
	ServiceVersion string

	ProfilingIntegration bool
}

func NewEmptyTracingConfig() *TracingConfig {
	return &TracingConfig{
		CustomAttribs: []attribute.KeyValue{},
	}
}

func NewJaegerTracingConfig(address string, propagation string) (*TracingConfig, error) {
	if address == "" {
		return nil, fmt.Errorf("address cannot be empty")
	}

	cfg := NewEmptyTracingConfig()
	cfg.Enabled = JaegerExporter
	cfg.Address = address
	cfg.Propagation = propagation
	return cfg, nil
}

func NewOTLPTracingConfig(address string, propagation string) (*TracingConfig, error) {
	if address == "" {
		return nil, fmt.Errorf("address cannot be empty")
	}

	cfg := NewEmptyTracingConfig()
	cfg.Enabled = OTLPExporter
	cfg.Address = address
	cfg.Propagation = propagation
	return cfg, nil
}

func (tc TracingConfig) OTelExporterEnabled() bool {
	return tc.Enabled == OTLPExporter
}
