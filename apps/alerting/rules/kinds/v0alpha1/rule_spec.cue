package v0alpha1

import "time"

#PromDurationWMillis: time.Duration & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?(([0-9]+)ms)?|0)$"

#PromDuration: time.Duration & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?|0)$"

TemplateString: string                       // =~ figure out the regex for the template string
#DatasourceUID: string & =~"^[a-zA-Z0-9_]+$" // TODO(@moustafab): validate regex for datasource UID

#RuleSpec: {
	title: string
	data: {
		// TODO: validate that only one can specify source=true
		// Note: any issues with go hash map key sorting?
		[string]: #Query
	}
	paused?: bool
	trigger: #IntervalTrigger
	labels: {
		[string]: TemplateString
	}
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

#Query: {
	queryType:         string
	relativeTimeRange: #RelativeTimeRange
	datasourceUID:     #DatasourceUID
	model:             _
	source?:           bool
}
