package v0alpha1

#RuleSearchSortField: "title" | "-title" | "group" | "-group" @cog(kind="enum",memberNames="TitleAsc|TitleDesc|GroupAsc|GroupDesc")

#RuleSearchType: "alertrule" | "recordingrule" @cog(kind="enum",memberNames="AlertRule|RecordingRule")

_ruleHitBase: {
	name:      string
	title:     string
	folder:    string
	group?:    string
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

// TermFacet is a single faceted term and the number of matching rules.
#TermFacet: {
	term:  string
	count: int64
}

// FacetResult is the distinct-term breakdown for one faceted field, e.g. the
// per-folder rule counts returned for facet=folder.
#FacetResult: {
	field:   string
	total:   int64
	missing: int64
	terms?: [...#TermFacet]
}
