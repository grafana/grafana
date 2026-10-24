package v1beta1

// PagerDuty integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#PagerdutyV0mimir1: {
	#Common
	type:    "pagerduty"
	version: "v0mimir1"
	settings: {
		url:          string
		client?:      string
		client_url?:  string
		description?: string
		details?: {
			[string]: string
		}
		images?:      string
		links?:       string
		source?:      string
		severity?:    string
		class?:       string
		component?:   string
		group?:       string
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
		routing_key?:                             bool
		service_key?:                             bool
	}
}

#PagerdutyV1: {
	#Common
	type:    "pagerduty"
	version: "v1"
	settings: {
		severity?:   string
		class?:      string
		component?:  string
		group?:      string
		summary?:    string
		source?:     string
		client?:     string
		client_url?: string
		details?: {
			[string]: string
		}
		url?: string
	}
	secureFields?: {
		integrationKey?: bool
	}
}
