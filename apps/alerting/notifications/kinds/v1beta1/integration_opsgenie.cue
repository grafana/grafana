package v1beta1

// OpsGenie integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#OpsgenieV0mimir1: {
	#Common
	type:    "opsgenie"
	version: "v0mimir1"
	settings: {
		api_url:      string
		message?:     string
		description?: string
		source?:      string
		details?: {
			[string]: string
		}
		entity?:        string
		actions?:       string
		tags?:          string
		note?:          string
		priority?:      string
		update_alerts?: bool
		responders?:    string
		http_config?:   #HTTPClientConfig
	}
	secureFields?: {
		api_key?:                                 bool
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
	}
}

#OpsgenieV1: {
	#Common
	type:    "opsgenie"
	version: "v1"
	settings: {
		apiUrl:            string
		message?:          string
		description?:      string
		autoClose?:        bool
		overridePriority?: bool
		sendTagsAs?:       "tags" | "details" | "both"
		responders?:       string
	}
	secureFields?: {
		apiKey?: bool
	}
}
