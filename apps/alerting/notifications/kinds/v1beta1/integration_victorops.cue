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
		api_key?: bool
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
