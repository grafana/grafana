package v1beta1

// Sensu Go integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#SensugoV1: {
	#Common
	type:    "sensugo"
	version: "v1"
	settings: {
		url:        string
		entity?:    string
		check?:     string
		handler?:   string
		namespace?: string
		message?:   string
	}
	secureFields?: {
		apikey?: bool
	}
}
