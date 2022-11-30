package setting

type Sentry struct {
	Enabled        bool    `json:"enabled"`
	DSN            string  `json:"dsn"`
	CustomEndpoint string  `json:"customEndpoint"`
	SampleRate     float64 `json:"sampleRate"`
	EndpointRPS    int     `json:"-"`
	EndpointBurst  int     `json:"-"`
}

func (cfg *Cfg) readSentryConfig() {
	raw := cfg.Raw.Section("log.frontend")
	provider := raw.Key("provider").MustString("sentry")
	if provider == "sentry" || provider != "grafana" {
		if raw.Key("sentry_dsn").String() == "" {
			cfg.Logger.Warn("frontend logging provider is Sentry, but Sentry DSN not configured")
		}
		if raw.Key("custom_endpoint").String() != "" {
			cfg.Logger.Warn("custom_endpoint is no longer support with Sentry as frontend logging provider")
		}
		cfg.Sentry = Sentry{
			Enabled:        raw.Key("enabled").MustBool(true),
			DSN:            raw.Key("sentry_dsn").String(),
			CustomEndpoint: raw.Key("custom_endpoint").MustString("/log"),
			SampleRate:     raw.Key("sample_rate").MustFloat64(),
			EndpointRPS:    raw.Key("log_endpoint_requests_per_second_limit").MustInt(3),
			EndpointBurst:  raw.Key("log_endpoint_burst_limit").MustInt(15),
		}
	}
}
