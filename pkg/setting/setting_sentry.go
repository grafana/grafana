package setting

type Sentry struct {
	Enabled        bool    `json:"enabled"`
	DSN            string  `json:"dsn"`
	CustomEndpoint string  `json:"customEndpoint"`
	SampleRate     float64 `json:"sampleRate"`
}

func (cfg *Cfg) readSentryConfig() {
	raw := cfg.Raw.Section("log.frontend")
	cfg.Sentry = Sentry{
		Enabled:        raw.Key("enabled").MustBool(true),
		DSN:            raw.Key("sentry_dsn").String(),
		CustomEndpoint: raw.Key("custom_endpoint").String(),
		SampleRate:     raw.Key("sample_rate").MustFloat64(),
	}
}
