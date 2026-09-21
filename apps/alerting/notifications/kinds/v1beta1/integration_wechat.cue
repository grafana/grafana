package v1beta1

// WeChat integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#WechatV0mimir1: {
	#Common
	type:    "wechat"
	version: "v0mimir1"
	settings: {
		api_url?:      string
		corp_id?:      string
		message?:      string
		message_type?: "text" | "markdown"
		agent_id?:     string
		to_user?:      string
		to_party?:     string
		to_tag?:       string
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
		api_secret?: bool
	}
}
