package v1beta1

// Grafana IRM integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#OncallV1: {
	#Common
	type:    "oncall"
	version: "v1"
	settings: {
		url:                   string
		httpMethod?:           "POST" | "PUT"
		username?:             string
		authorization_scheme?: string
		maxAlerts?:            string
		title?:                string
		message?:              string
	}
	secureFields?: {
		authorization_credentials?: bool
		password?:                  bool
	}
}
