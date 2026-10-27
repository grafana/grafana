package tracing

import (
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
)

type TracingConfig struct {
	// Exporter is one of JaegerExporter, OTLPExporter, FileExporter, or
	// NoopExporter. Empty means tracing is not configured, so the global
	// tracer provider is left alone.
	Exporter      string
	Address       string
	Propagation   string
	CustomAttribs []attribute.KeyValue

	Sampler          string
	SamplerParam     float64
	SamplerRemoteURL string

	ServiceName    string
	ServiceVersion string

	ProfilingIntegration bool
	Insecure             bool

	// FilterOperationalEndpoints, when true, drops server spans for
	// high-frequency operational endpoints (/metrics, /healthz, /readyz,
	// /livez, /debug/pprof/*). Disabled by default to preserve existing
	// behavior; opt in to keep those endpoints out of traces.
	FilterOperationalEndpoints bool

	// File exporter: captures spans to a local OTLP/JSON file for offline
	// analysis (e.g. upload to Grafana via Explore) without a tracing backend.
	FilePath            string
	FileMaxSize         int64
	FileCaptureDuration time.Duration
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
	cfg.Exporter = JaegerExporter
	cfg.Address = address
	cfg.Propagation = propagation
	return cfg, nil
}

func NewOTLPTracingConfig(address string, propagation string, insecure bool) (*TracingConfig, error) {
	if address == "" {
		return nil, fmt.Errorf("address cannot be empty")
	}

	cfg := NewEmptyTracingConfig()
	cfg.Exporter = OTLPExporter
	cfg.Address = address
	cfg.Propagation = propagation
	cfg.Insecure = insecure
	return cfg, nil
}

func (tc TracingConfig) OTelExporterEnabled() bool {
	return tc.Exporter == OTLPExporter
}
