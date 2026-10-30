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
		http_config?:  #HTTPClientConfig
	}
	secureFields?: {
		api_secret?:                              bool
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
	}
}
