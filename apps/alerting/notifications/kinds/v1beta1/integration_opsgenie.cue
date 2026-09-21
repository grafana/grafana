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
