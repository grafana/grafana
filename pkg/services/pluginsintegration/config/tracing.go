package config

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	pCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/setting"
)

// newTracingCfg creates a plugins tracing configuration based on the provided Grafana tracing config.
// If OpenTelemetry (OTLP) is disabled, a zero-value OpenTelemetryCfg is returned.
func newTracingCfg(grafanaCfg *setting.Cfg) (pCfg.Tracing, error) {
	ots, err := tracing.ParseSettings(grafanaCfg)
	if err != nil {
		return pCfg.Tracing{}, fmt.Errorf("parse settings: %w", err)
	}
	if !ots.OTelExporterEnabled() {
		return pCfg.Tracing{}, nil
	}
	return pCfg.Tracing{
		OpenTelemetry: pCfg.OpenTelemetryCfg{
			Address:     ots.Address,
			Propagation: ots.Propagation,
		},
	}, nil
}
