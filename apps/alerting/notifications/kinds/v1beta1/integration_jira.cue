package v1beta1

// Jira integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#JiraV0mimir1: {
	#Common
	type:    "jira"
	version: "v0mimir1"
	settings: {
		api_url:              string
		project:              string
		issue_type:           string
		summary?:             string
		description?:         string
		labels?:              string
		priority?:            string
		reopen_transition?:   string
		resolve_transition?:  string
		wont_fix_resolution?: string
		reopen_duration?:     string
		fields?: {
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
}

#JiraV1: {
	#Common
	type:    "jira"
	version: "v1"
	settings: {
		api_url:              string
		project:              string
		issue_type:           string
		summary?:             string
		description?:         string
		labels?:              string
		priority?:            string
		resolve_transition?:  string
		reopen_transition?:   string
		reopen_duration?:     string
		wont_fix_resolution?: string
		dedup_key_field?:     string
		fields?: {
			[string]: string
		}
	}
	secureFields?: {
		api_token?: bool
		password?:  bool
		user?:      bool
	}
}
