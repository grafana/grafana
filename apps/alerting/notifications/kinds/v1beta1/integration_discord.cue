package v1beta1

// Discord integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#DiscordV0mimir1: {
	#Common
	type:    "discord"
	version: "v0mimir1"
	settings: {
		title?:       string
		message?:     string
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
		webhook_url?:                             bool
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
