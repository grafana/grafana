package setting

type GrafanaJavascriptAgent struct {
	Enabled                             bool   `json:"enabled"`
	CustomEndpoint                      string `json:"customEndpoint"`
	EndpointRPS                         int    `json:"-"`
	EndpointBurst                       int    `json:"-"`
	AllInstrumentationsEnabeld          bool   `json:"allInstrumentationEnabeld"`
	ErrorInstrumentalizationEnabled     bool   `json:"errorInstrumentalizationEnabled"`
	ConsoleInstrumentalizationEnabled   bool   `json:"consoleInstrumentalizationEnabled"`
	WebVitalsInstrumentalizationEnabled bool   `json:"webVitalsInstrumentalizationEnabled"`
	TracingInstrumentalizationEnabled   bool   `json:"tracingInstrumentalizationEnabled"`
	InternalLoggerLevel                 int    `json:"internalLoggerLevel"`
	ApiKey                              string `json:"apiKey"`
}

func (cfg *Cfg) readGrafanaJavascriptAgentConfig() {
	raw := cfg.Raw.Section("log.frontend")
	cfg.GrafanaJavascriptAgent = GrafanaJavascriptAgent{
		Enabled:                             raw.Key("enabled").MustBool(true),
		CustomEndpoint:                      raw.Key("custom_endpoint").MustString("/log-grafana-javascript-agent"),
		EndpointRPS:                         raw.Key("log_endpoint_requests_per_second_limit").MustInt(3),
		EndpointBurst:                       raw.Key("log_endpoint_burst_limit").MustInt(15),
		AllInstrumentationsEnabeld:          raw.Key("instrumentations_all_enabled").MustBool(false),
		ErrorInstrumentalizationEnabled:     raw.Key("instrumentations_errors_enabled").MustBool(true),
		ConsoleInstrumentalizationEnabled:   raw.Key("instrumentations_console_enabled").MustBool(true),
		WebVitalsInstrumentalizationEnabled: raw.Key("instrumentations_webvitals_enabled").MustBool(true),
		TracingInstrumentalizationEnabled:   raw.Key("instrumentations_tracing_enabled").MustBool(true),
		InternalLoggerLevel:                 raw.Key("internal_logger_level").MustInt(0),
		ApiKey:                              raw.Key("api_key").String(),
	}
}
