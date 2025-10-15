package setting

type GrafanaJavascriptAgent struct {
	EndpointRPS   int `json:"-"`
	EndpointBurst int `json:"-"`

	// Faro config
	Enabled                               bool   `json:"enabled"`
	CustomEndpoint                        string `json:"customEndpoint"`
	ApiKey                                string `json:"apiKey"`
	InternalLoggerLevel                   int    `json:"internalLoggerLevel"`
	ConsoleInstrumentalizationEnabled     bool   `json:"consoleInstrumentalizationEnabled"`
	PerformanceInstrumentalizationEnabled bool   `json:"performanceInstrumentalizationEnabled"`
	CSPInstrumentalizationEnabled         bool   `json:"cspInstrumentalizationEnabled"`
	TracingInstrumentalizationEnabled     bool   `json:"tracingInstrumentalizationEnabled"`
	WebVitalsAttributionEnabled           bool   `json:"webVitalsAttributionEnabled"`
}

func (cfg *Cfg) readGrafanaJavascriptAgentConfig() {
	raw := cfg.Raw.Section("log.frontend")
	cfg.GrafanaJavascriptAgent = GrafanaJavascriptAgent{
		EndpointRPS:   raw.Key("log_endpoint_requests_per_second_limit").MustInt(3),
		EndpointBurst: raw.Key("log_endpoint_burst_limit").MustInt(15),

		// Faro config
		Enabled:                               raw.Key("enabled").MustBool(false),
		CustomEndpoint:                        raw.Key("custom_endpoint").MustString("/log-grafana-javascript-agent"),
		ApiKey:                                raw.Key("api_key").String(),
		InternalLoggerLevel:                   raw.Key("internal_logger_level").MustInt(0),
		ConsoleInstrumentalizationEnabled:     raw.Key("instrumentations_console_enabled").MustBool(true),
		PerformanceInstrumentalizationEnabled: raw.Key("instrumentations_performance_enabled").MustBool(true),
		CSPInstrumentalizationEnabled:         raw.Key("instrumentations_csp_enabled").MustBool(true),
		TracingInstrumentalizationEnabled:     raw.Key("instrumentations_tracing_enabled").MustBool(true),
		WebVitalsAttributionEnabled:           raw.Key("web_vitals_attribution_enabled").MustBool(true),
	}
}
