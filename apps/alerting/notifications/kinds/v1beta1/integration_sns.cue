package v1beta1

// AWS SNS integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#SnsV0mimir1: {
	#Common
	type:    "sns"
	version: "v0mimir1"
	settings: {
		api_url?:      string
		sigv4?:        #Sigv4
		topic_arn?:    string
		phone_number?: string
		target_arn?:   string
		subject?:      string
		message?:      string
		attributes?: {
			[string]: string
		}
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
		"sigv4.secret_key"?:                      bool
	}
}

#SnsV1: {
	#Common
	type:    "sns"
	version: "v1"
	settings: {
		api_url?:      string
		sigv4?:        #Sigv4
		topic_arn?:    string
		phone_number?: string
		target_arn?:   string
		subject?:      string
		message?:      string
		attributes?: {
			[string]: string
		}
	}
	secureFields?: {
		"sigv4.access_key"?: bool
		"sigv4.secret_key"?: bool
	}
}
