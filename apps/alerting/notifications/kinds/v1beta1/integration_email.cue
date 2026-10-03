package v1beta1

// Email integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#EmailV0mimir1: {
	#Common
	type:    "email"
	version: "v0mimir1"
	settings: {
		to:             string
		from?:          string
		smarthost?:     string
		hello?:         string
		auth_username?: string
		auth_identity?: string
		require_tls?:   bool
		html?:          string
		text?:          string
		headers?: {
			[string]: string
		}
		tls_config?: #TLSConfig
	}
	secureFields?: {
		auth_password?: bool
		auth_secret?:   bool
	}
}

#EmailV1: {
	#Common
	type:    "email"
	version: "v1"
	settings: {
		singleEmail?: bool
		addresses:    string
		message?:     string
		subject?:     string
	}
}
