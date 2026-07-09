package v0alpha1

#RuleSearchSortField: "title" | "-title" @cog(kind="enum",memberNames="TitleAsc|TitleDesc")

#RuleSearchType: "alertrule" | "recordingrule" @cog(kind="enum",memberNames="AlertRule|RecordingRule")

_ruleHitBase: {
	name:      string
	title:     string
	folder:    string
	interval?: string
	paused?:   bool
	labels?: [string]: string
	datasourceUIDs?: [...string]
}

#AlertRuleHit: {
	_ruleHitBase
	type: #RuleSearchType & "alertrule"
	annotations?: [string]: string
	"for"?:            string
	keepFiringFor?:    string
	dashboardUID?:     string
	panelID?:          int64
	receiver?:         string
	notificationType?: string
	routingTree?:      string
}

#RecordingRuleHit: {
	_ruleHitBase
	type:                 #RuleSearchType & "recordingrule"
	metric?:              string
	targetDatasourceUID?: string
}

// RuleHit is the cross-kind union returned by /search.
#RuleHit: #AlertRuleHit | #RecordingRuleHit
