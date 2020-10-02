package setting

type Sentry struct {
	Enabled        bool   `json:"enabled"`
	Dsn            string `json:"dsn"`
	CustomEndpoint string `json:"customEndpoint"`
}

func (cfg *Cfg) readSentryConfig() {
	sentryRaw := cfg.Raw.Section("sentry")
	cfg.Sentry = Sentry{
		Enabled:        sentryRaw.Key("enabled").MustBool(true),
		Dsn:            sentryRaw.Key("dsn").String(),
		CustomEndpoint: sentryRaw.Key("custom_endpoint").String(),
	}
}
