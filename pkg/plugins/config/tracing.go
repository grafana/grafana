package config

// OpenTelemetryCfg contains the Opentelemetry address and propagation config values.
// This is used to export the Opentelemetry (OTLP) config without exposing the whole *setting.Cfg.
type OpenTelemetryCfg struct {
	Address     string
	Propagation string
}

// IsEnabled returns true if OTLP tracing is enabled (address set)
func (c OpenTelemetryCfg) IsEnabled() bool {
	return c.Address != ""
}
