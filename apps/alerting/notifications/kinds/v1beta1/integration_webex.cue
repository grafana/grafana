package v1beta1

// Cisco Webex Teams integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#WebexV0mimir1: {
	#Common
	type:    "webex"
	version: "v0mimir1"
	settings: {
		api_url?:     string
		room_id:      string
		message?:     string
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
	}
}

#WebexV1: {
	#Common
	type:    "webex"
	version: "v1"
	settings: {
		api_url?: string
		room_id:  string
		message?: string
	}
	secureFields?: {
		bot_token?: bool
	}
}
