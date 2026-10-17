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
		http_config?:  #HTTPClientConfig
	}
	secureFields?: {
		api_url?:                                 bool
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
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
