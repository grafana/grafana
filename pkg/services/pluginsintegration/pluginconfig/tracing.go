package pluginconfig

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	pCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/setting"
)

// newTracingCfg creates a plugins tracing configuration based on the provided Grafana tracing config.
// If OpenTelemetry (OTLP) is disabled, a zero-value OpenTelemetryCfg is returned.
func newTracingCfg(settingsProvider setting.SettingsProvider) (pCfg.Tracing, error) {
	tracingCfg, err := tracing.ParseTracingConfig(settingsProvider)
	if err != nil {
		return pCfg.Tracing{}, fmt.Errorf("parse settings: %w", err)
	}
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
