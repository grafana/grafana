package v1beta1

// Discord integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#DiscordV0mimir1: {
	#Common
	type:    "discord"
	version: "v0mimir1"
	settings: {
		title?:   string
		message?: string
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
		webhook_url?: bool
	}
}

#DiscordV1: {
	#Common
	type:    "discord"
	version: "v1"
	settings: {
		title?:                 string
		message?:               string
		avatar_url?:            string
		use_discord_username?:  bool
		use_embed_description?: bool
	}
	secureFields?: {
		url?: bool
	}
}
