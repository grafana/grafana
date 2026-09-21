package v1beta1

// LINE integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#LINEV1: {
	#Common
	type:    "LINE"
	version: "v1"
	settings: {
		title?:       string
		description?: string
	}
	secureFields?: {
		token?: bool
	}
}
