package pluginconfig

import (
	"github.com/grafana/grafana/pkg/infra/tracing"
	pCfg "github.com/grafana/grafana/pkg/plugins/config"
)

// NewTracingCfg creates a plugins tracing configuration based on the provided Grafana tracing config.
// If OpenTelemetry (OTLP) is disabled, a zero-value OpenTelemetryCfg is returned.
func NewTracingCfg(tracingCfg *tracing.TracingConfig) (pCfg.Tracing, error) {
	if !tracingCfg.OTelExporterEnabled() {
		return pCfg.Tracing{}, nil
	}
	return pCfg.Tracing{
		OpenTelemetry: pCfg.OpenTelemetryCfg{
			Address:          tracingCfg.Address,
			Propagation:      tracingCfg.Propagation,
			Sampler:          tracingCfg.Sampler,
			SamplerParam:     tracingCfg.SamplerParam,
			SamplerRemoteURL: tracingCfg.SamplerRemoteURL,
		},
	}, nil
}
