package v1beta1

// Webhook integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#WebhookV0mimir1: {
	#Common
	type:    "webhook"
	version: "v0mimir1"
	settings: {
		max_alerts?: string
		timeout?:    string
		http_config?: {
			basic_auth?: {
				username?: string
			}
			authorization?: {
				type?: string
			}
			follow_redirects?: bool
			enable_http2?:     bool
			http_headers?: {
				[string]: string
			}
			proxy_url?:              string
			no_proxy?:               string
			proxy_from_environment?: bool
			proxy_connect_header?: {
				[string]: string
			}
			tls_config?: {
				server_name?:          string
				insecure_skip_verify?: bool
				min_version?:          string
				max_version?:          string
			}
			oauth2?: {
				client_id: string
				token_url: string
				scopes?:   string
				endpoint_params?: {
					[string]: string
				}
				tls_config?: {
					server_name?:          string
					insecure_skip_verify?: bool
					min_version?:          string
					max_version?:          string
				}
				proxy_url?:              string
				no_proxy?:               string
				proxy_from_environment?: bool
				proxy_connect_header?: {
					[string]: string
				}
			}
		}
	}
	secureFields?: {
		url?: bool
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
		tlsConfig?: {
			insecureSkipVerify?: bool
		}
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
				tls_config?: {
					insecureSkipVerify?: bool
				}
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
		authorization_credentials?:     bool
		"hmacConfig.secret"?:           bool
		password?:                      bool
		"tlsConfig.caCertificate"?:     bool
		"tlsConfig.clientCertificate"?: bool
		"tlsConfig.clientKey"?:         bool
	}
}
