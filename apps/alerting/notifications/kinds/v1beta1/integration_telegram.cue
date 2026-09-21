package v1beta1

// Telegram integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#TelegramV0mimir1: {
	#Common
	type:    "telegram"
	version: "v0mimir1"
	settings: {
		api_url?:               string
		chat_id:                string
		message?:               string
		disable_notifications?: bool
		parse_mode?:            "MarkdownV2" | "Markdown" | "HTML"
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
		token?: bool
	}
}

#TelegramV1: {
	#Common
	type:    "telegram"
	version: "v1"
	settings: {
		chatid:                    string
		message_thread_id?:        string
		message?:                  string
		parse_mode?:               "None" | "HTML" | "Markdown" | "MarkdownV2"
		disable_web_page_preview?: bool
		protect_content?:          bool
		disable_notifications?:    bool
	}
	secureFields?: {
		bottoken?: bool
	}
}
