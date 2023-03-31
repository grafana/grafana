package config

type Tracing struct {
	Enabled       bool
	OpenTelemetry OpenTelemetryCfg
}

// OpenTelemetryCfg contains the OpenTlemetry address and propagation config values.
// This is used to export the OpenTelemetry (OTLP) config without exposing the whole *setting.Cfg.
type OpenTelemetryCfg struct {
	Address     string
	Propagation string
}

// IsEnabled returns true if OTLP tracing is enabled (address set)
func (c OpenTelemetryCfg) IsEnabled() bool {
	return c.Address != ""
}
