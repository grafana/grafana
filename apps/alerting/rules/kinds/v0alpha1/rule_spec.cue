// TODO: many strings need to be validated as having the appropriate minimum length using strings.minRunes(n)
package v0alpha1

#PromDurationWMillis: string & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?(([0-9]+)ms)?|0)$"

#PromDuration: string & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?|0)$" & !~"hmuµn"

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

#ExpressionMap: {
	[string]: #Expression
}

#Expression: {
	queryType?:         string
	relativeTimeRange?: #RelativeTimeRange
	datasourceUID?:     #DatasourceUID
	model:              _
	source?:            bool
}
