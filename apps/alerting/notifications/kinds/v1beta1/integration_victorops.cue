package v1beta1

// VictorOps integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#VictoropsV0mimir1: {
	#Common
	type:    "victorops"
	version: "v0mimir1"
	settings: {
		api_url?:             string
		routing_key:          string
		message_type?:        string
		entity_display_name?: string
		state_message?:       string
		monitoring_tool?:     string
		custom_fields?: {
			[string]: string
		}
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		api_key?:                                 bool
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
	}
}

#VictoropsV1: {
	#Common
	type:    "victorops"
	version: "v1"
	settings: {
		messageType?: "CRITICAL" | "WARNING"
		title?:       string
		description?: string
	}
	secureFields?: {
		url?: bool
	}
}
