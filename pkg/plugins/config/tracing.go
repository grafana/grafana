package config

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

const otlpExporter string = "otlp"

// OpentelemetryCfg contains the Opentelemetry address and propagation config values.
// This is used to export the Opentelemetry (OTLP) config without exposing the whole *setting.Cfg.
type OpentelemetryCfg struct {
	Address     string
	Propagation string
}

// IsEnabled returns true if OTLP tracing is enabled (address set)
func (c OpentelemetryCfg) IsEnabled() bool {
	return c.Address != ""
}

// NewOpentelemetryCfg creates a new OpentelemetryCfg based on the provided Grafana config.
// If Opentelemetry (OTLP) is disabled, a zero-value OpentelemetryCfg is returned.
func NewOpentelemetryCfg(grafanaCfg *setting.Cfg) (OpentelemetryCfg, error) {
	ots, err := tracing.ParseSettingsOpentelemetry(grafanaCfg)
	if err != nil {
		return OpentelemetryCfg{}, fmt.Errorf("parse settings: %w", err)
	}
	if ots.Enabled != otlpExporter {
		return OpentelemetryCfg{}, nil
	}
	return OpentelemetryCfg{
		Address:     ots.Address,
		Propagation: ots.Propagation,
	}, nil
}
