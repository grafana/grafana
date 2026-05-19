package v0alpha1

#PromDuration: string & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?|0)$" & !~"hmuµn"

// PrometheusRuleSpec mirrors the structure of a Prometheus rules file:
// a list of named groups, each holding alerting and/or recording rules.
PrometheusRuleSpec: {
	groups: [...#PrometheusRuleGroup]
}

#PrometheusRuleGroup: {
	name:         string
	interval?:    #PromDuration
	queryOffset?: #PromDuration
	limit?:       int & >=0
	labels?: {
		[string]: string
	}
	rules: [...#RuleEntry]
}

// #PrometheusRuleEntry: #PrometheusAlertingRuleEntry | #PrometheusRecordingRuleEntry

#RuleEntry: {
	expr:           string
	"for"?:         #PromDuration
	keepFiringFor?: #PromDuration
	labels?: {
		[string]: string
	}
	annotations?: {
		[string]: string
	}

	record?: string

	alert?: string
}

// #PrometheusRecordingRuleEntry: #RuleEntry & {
// 	record: string
// }

// #PrometheusAlertingRuleEntry: #RuleEntry & {
// 	alert: string
// }
