package v0alpha1

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
	rules: [...#PrometheusRuleEntry]
}

#PrometheusRuleEntry: {
	alert?:         string
	record?:        string
	expr:           string
	"for"?:         #PromDuration
	keepFiringFor?: #PromDuration
	labels?: {
		[string]: string
	}
	annotations?: {
		[string]: string
	}
}
