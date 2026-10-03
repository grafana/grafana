package v1beta1

// WeCom integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#WecomV1: {
	#Common
	type:    "wecom"
	version: "v1"
	settings: {
		agent_id: string
		corp_id:  string
		msgtype?: "text" | "markdown"
		message?: string
		title?:   string
		touser?:  string
	}
	secureFields?: {
		secret?: bool
		url?:    bool
	}
}
