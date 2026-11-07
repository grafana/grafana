package v1beta1

// Google Chat integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#GooglechatV1: {
	#Common
	type:    "googlechat"
	version: "v1"
	settings: {
		title?:             string
		message?:           string
		hide_open_button?:  bool
		hide_version_info?: bool
	}
	secureFields?: {
		url?: bool
	}
}
