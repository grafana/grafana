package v1beta1

// AWS SNS integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#SnsV0mimir1: {
	#Common
	type:    "sns"
	version: "v0mimir1"
	settings: {
		api_url?: string
		sigv4?: {
			region?:     string
			access_key?: string
			profile?:    string
			role_arn?:   string
		}
		topic_arn?:    string
		phone_number?: string
		target_arn?:   string
		subject?:      string
		message?:      string
		attributes?: {
			[string]: string
		}
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
		"sigv4.secret_key"?: bool
	}
}

#SnsV1: {
	#Common
	type:    "sns"
	version: "v1"
	settings: {
		api_url?: string
		sigv4?: {
			region?:   string
			profile?:  string
			role_arn?: string
		}
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
