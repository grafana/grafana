package v1beta1

// DingDing integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#DingdingV1: {
	#Common
	type:    "dingding"
	version: "v1"
	settings: {
		msgType?: "link" | "actionCard"
		title?:   string
		message?: string
	}
	secureFields?: {
		url?: bool
	}
}
