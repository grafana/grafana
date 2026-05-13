package v0alpha1

PrometheusRuleGroupSpec: {
	name:         string
	interval?:    #PromDuration
	queryOffset?: #PromDuration
	limit?:       int & >=0
	labels?: {
		[string]: string
	}
	rules: [...#PrometheusRule]
}

#PrometheusRule: {
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
