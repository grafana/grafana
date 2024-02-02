package config

type Tracing struct {
	OpenTelemetry OpenTelemetryCfg
}

// OpenTelemetryCfg contains the OpenTelemetry address and propagation config values.
// This is used to export the OpenTelemetry (OTLP) config without exposing the whole *setting.Cfg.
type OpenTelemetryCfg struct {
	Address     string
	Propagation string

	Sampler          string
	SamplerParam     float64
	SamplerRemoteURL string
}

// IsEnabled returns true if OTLP tracing is enabled (address set)
func (t Tracing) IsEnabled() bool {
	return t.OpenTelemetry.Address != ""
}
