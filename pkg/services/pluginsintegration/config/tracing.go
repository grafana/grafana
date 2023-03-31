package config

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	pCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/setting"
)

// newOpenTelemetryCfg creates a new OpenTelemetryCfg based on the provided Grafana config.
// If OpenTelemetry (OTLP) is disabled, a zero-value OpenTelemetryCfg is returned.
func newOpenTelemetryCfg(grafanaCfg *setting.Cfg) (pCfg.OpenTelemetryCfg, error) {
	ots, err := tracing.ParseSettingsOpentelemetry(grafanaCfg)
	if err != nil {
		return pCfg.OpenTelemetryCfg{}, fmt.Errorf("parse settings: %w", err)
	}
	if !ots.OtelExporterEnabled() {
		return pCfg.OpenTelemetryCfg{}, nil
	}
	return pCfg.OpenTelemetryCfg{
		Address:     ots.Address,
		Propagation: ots.Propagation,
	}, nil
}
