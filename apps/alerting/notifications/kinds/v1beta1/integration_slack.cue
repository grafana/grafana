package v1beta1

// Slack integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#SlackV0mimir1: {
	#Common
	type:    "slack"
	version: "v0mimir1"
	settings: {
		channel?:      string
		username?:     string
		icon_emoji?:   string
		icon_url?:     string
		link_names?:   bool
		callback_id?:  string
		color?:        string
		fallback?:     string
		footer?:       string
		mrkdwn_in?:    string
		pretext?:      string
		short_fields?: bool
		text?:         string
		title?:        string
		title_link?:   string
		image_url?:    string
		thumb_url?:    string
		actions?:      string
		fields?:       string
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
		api_url?: bool
	}
}

#SlackV1: {
	#Common
	type:    "slack"
	version: "v1"
	settings: {
		recipient:       string
		username?:       string
		icon_emoji?:     string
		icon_url?:       string
		mentionUsers?:   string
		mentionGroups?:  string
		mentionChannel?: "here" | "channel"
		endpointUrl?:    string
		color?:          string
		title?:          string
		text?:           string
		footer?:         string
	}
	secureFields?: {
		token?: bool
		url?:   bool
	}
}
