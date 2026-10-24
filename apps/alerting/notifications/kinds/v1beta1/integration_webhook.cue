package v1beta1

// Webhook integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#WebhookV0mimir1: {
	#Common
	type:    "webhook"
	version: "v0mimir1"
	settings: {
		max_alerts?:  string
		timeout?:     string
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
		url?:                                     bool
	}
}

#WebhookV1: {
	#Common
	type:    "webhook"
	version: "v1"
	settings: {
		url:                   string
		httpMethod?:           "POST" | "PUT"
		username?:             string
		authorization_scheme?: string
		headers?: {
			[string]: string
		}
		maxAlerts?: string
		title?:     string
		message?:   string
		payload?: {
			template: string
			vars?: {
				[string]: string
			}
		}
		tlsConfig?: #GrafanaTLSConfig
		hmacConfig?: {
			header?:          string
			timestampHeader?: string
		}
		http_config?: {
			oauth2?: {
				token_url: string
				client_id: string
				scopes?:   string
				endpoint_params?: {
					[string]: string
				}
				tls_config?: #GrafanaTLSConfig
				proxy_config?: {
					proxy_url?:              string
					proxy_from_environment?: bool
					no_proxy?:               string
					proxy_connect_header?: {
						[string]: string
					}
				}
			}
		}
	}
	secureFields?: {
		authorization_credentials?:                         bool
		"hmacConfig.secret"?:                               bool
		"http_config.oauth2.client_secret"?:                bool
		"http_config.oauth2.tls_config.caCertificate"?:     bool
		"http_config.oauth2.tls_config.clientCertificate"?: bool
		"http_config.oauth2.tls_config.clientKey"?:         bool
		password?:                                          bool
		"tlsConfig.caCertificate"?:                         bool
		"tlsConfig.clientCertificate"?:                     bool
		"tlsConfig.clientKey"?:                             bool
	}
}
