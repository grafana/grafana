package v1beta1

// Pushover integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#PushoverV0mimir1: {
	#Common
	type:    "pushover"
	version: "v0mimir1"
	settings: {
		title?:       string
		message?:     string
		url?:         string
		url_title?:   string
		device?:      string
		sound?:       string
		priority?:    string
		retry?:       string
		expire?:      string
		ttl?:         string
		html?:        bool
		http_config?: #HTTPClientConfig
	}
	secureFields?: {
		"http_config.authorization.credentials"?: bool
		"http_config.basic_auth.password"?:       bool
		"http_config.oauth2.client_secret"?:      bool
		token?:                                   bool
		user_key?:                                bool
	}
}

#PushoverV1: {
	#Common
	type:    "pushover"
	version: "v1"
	settings: {
		device?:     string
		priority?:   string
		okPriority?: string
		retry?:      string
		expire?:     string
		sound?:      "default" | "pushover" | "bike" | "bugle" | "cashregister" | "classical" | "cosmic" | "falling" | "gamelan" | "incoming" | "intermission" | "magic" | "mechanical" | "pianobar" | "siren" | "spacealarm" | "tugboat" | "alien" | "climb" | "persistent" | "echo" | "updown" | "none"
		okSound?:    "default" | "pushover" | "bike" | "bugle" | "cashregister" | "classical" | "cosmic" | "falling" | "gamelan" | "incoming" | "intermission" | "magic" | "mechanical" | "pianobar" | "siren" | "spacealarm" | "tugboat" | "alien" | "climb" | "persistent" | "echo" | "updown" | "none"
		title?:      string
		message?:    string
	}
	secureFields?: {
		apiToken?: bool
		userKey?:  bool
	}
}
