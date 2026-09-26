package v1beta1

// Microsoft Teams integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#TeamsV0mimir1: {
	#Common
	type:    "teams"
	version: "v0mimir1"
	settings: {
		title?:       string
		summary?:     string
		text?:        string
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
		webhook_url?:                             bool
	}
}

#TeamsV0mimir2: {
	#Common
	type:    "teams"
	version: "v0mimir2"
	settings: {
		title?:       string
		text?:        string
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
		webhook_url?:                             bool
	}
}

#TeamsV1: {
	#Common
	type:    "teams"
	version: "v1"
	settings: {
		url:           string
		title?:        string
		sectiontitle?: string
		message?:      string
	}
}
