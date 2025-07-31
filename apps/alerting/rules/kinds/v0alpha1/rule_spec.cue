// TODO: many strings need to be validated as having the appropriate minimum length using strings.minRunes(n)
package v0alpha1

import "time"

#PromDurationWMillis: time.Duration & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?(([0-9]+)ms)?|0)$"

#PromDuration: time.Duration & =~"^((([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?|0)$" & !~"hmuµn"

TemplateString: string
#DatasourceUID: string & =~"^[a-zA-Z0-9_-]+$"

#RuleSpec: {
	title:   string
	data:    #QueryMap
	paused?: bool
	trigger: #IntervalTrigger
	labels?: {
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

// TODO: validate that only one can specify source=true
#QueryMap: {
	[string]: #Query
} // & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per

// TODO: come up with a better name for this. We have expression type things and data source queries
#Query: {
	queryType:          string // TODO: consider making this optional, with the nil value meaning "__expr__" (i.e. expression query)
	relativeTimeRange?: #RelativeTimeRange
	datasourceUID:      #DatasourceUID
	model:              _
	source?:            bool
}
