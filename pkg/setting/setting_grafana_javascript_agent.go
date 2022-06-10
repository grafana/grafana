package setting

type GrafanaJavascriptAgent struct {
	Enabled        bool   `json:"enabled"`
	CustomEndpoint string `json:"customEndpoint"`
	EndpointRPS    int    `json:"-"`
	EndpointBurst  int    `json:"-"`
}

func (cfg *Cfg) readGrafanaJavascriptAgentConfig() {
	raw := cfg.Raw.Section("log.frontend")
	provider := raw.Key("provider").MustString("sentry")
	if provider == "grafana" {
		cfg.GrafanaJavascriptAgent = GrafanaJavascriptAgent{
			Enabled:        raw.Key("enabled").MustBool(true),
			CustomEndpoint: raw.Key("custom_endpoint").String(),
			EndpointRPS:    raw.Key("log_endpoint_requests_per_second_limit").MustInt(),
			EndpointBurst:  raw.Key("log_endpoint_burst_limit").MustInt(),
		}
	}
}
