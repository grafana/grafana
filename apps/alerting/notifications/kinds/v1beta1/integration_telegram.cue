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
		http_config?:           #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
		token?:                                   bool
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
