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
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
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
