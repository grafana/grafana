package v1beta1

// Threema Gateway integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#ThreemaV1: {
	#Common
	type:    "threema"
	version: "v1"
	settings: {
		gateway_id:   string
		recipient_id: string
		title?:       string
		description?: string
	}
	secureFields?: {
		api_secret?: bool
	}
}
