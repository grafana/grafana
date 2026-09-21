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
		images?:    string
		links?:     string
		source?:    string
		severity?:  string
		class?:     string
		component?: string
		group?:     string
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
		routing_key?: bool
		service_key?: bool
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
