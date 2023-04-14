package setting

type GrafanaJavascriptAgent struct {
	Enabled                             bool   `json:"enabled"`
	CustomEndpoint                      string `json:"customEndpoint"`
	EndpointRPS                         int    `json:"-"`
	EndpointBurst                       int    `json:"-"`
	ErrorInstrumentalizationEnabled     bool   `json:"errorInstrumentalizationEnabled"`
	ConsoleInstrumentalizationEnabled   bool   `json:"consoleInstrumentalizationEnabled"`
	WebVitalsInstrumentalizationEnabled bool   `json:"webVitalsInstrumentalizationEnabled"`
	ApiKey                              string `json:"apiKey"`
}

func (cfg *Cfg) readGrafanaJavascriptAgentConfig() {
	raw := cfg.Raw.Section("log.frontend")
	provider := raw.Key("provider").MustString("sentry")
	if provider == "grafana" {
		cfg.GrafanaJavascriptAgent = GrafanaJavascriptAgent{
			Enabled:                             raw.Key("enabled").MustBool(true),
			CustomEndpoint:                      raw.Key("custom_endpoint").MustString("/log-grafana-javascript-agent"),
			EndpointRPS:                         raw.Key("log_endpoint_requests_per_second_limit").MustInt(3),
			EndpointBurst:                       raw.Key("log_endpoint_burst_limit").MustInt(15),
			ErrorInstrumentalizationEnabled:     raw.Key("instrumentations_errors_enabled").MustBool(true),
			ConsoleInstrumentalizationEnabled:   raw.Key("instrumentations_console_enabled").MustBool(true),
			WebVitalsInstrumentalizationEnabled: raw.Key("instrumentations_webvitals_enabled").MustBool(true),
			ApiKey:                              raw.Key("api_key").String(),
		}
	}
}
