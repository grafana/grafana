// TODO: many strings need to be validated as having the appropriate minimum length using strings.minRunes(n)
package v0alpha1

import "time"

#PromDurationWMillis: time.Duration & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?(([0-9]+)ms)?|0)$"

#PromDuration: time.Duration & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?|0)$" & !~"hmuµn"

TemplateString: string
#DatasourceUID: string & =~"^[a-zA-Z0-9_-]+$"

#RuleSpec: {
	title:   string
	paused?: bool
	trigger: #IntervalTrigger
	labels?: {
		[string]: TemplateString
	}
	expressions: #ExpressionMap
	...
}

// TODO(@moustafab): when we support other trigger types ensure that none of the fields conflict
// #TriggerType: #IntervalTrigger

#IntervalTrigger: {
	interval: #PromDuration
}

#RelativeTimeRange: {
	from: #PromDurationWMillis
	to:   #PromDurationWMillis
}

// TODO: validate that only one can specify source=true
#ExpressionMap: {
	[string]: #Expression
} // & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per

#Expression: {
	// The type of query if this is a query expression
	queryType?:         string
	relativeTimeRange?: #RelativeTimeRange
	// The UID of the datasource to run this expression against. If omitted, the expression will be run against the `__expr__` datasource
	datasourceUID?: #DatasourceUID
	model:          _
	// Used to mark the expression to be used as the final source for the rule evaluation
	// Only one expression in a rule can be marked as the source
	// For AlertRules, this is the expression that will be evaluated against the alerting condition
	// For RecordingRules, this is the expression that will be recorded
	source?: bool
}
