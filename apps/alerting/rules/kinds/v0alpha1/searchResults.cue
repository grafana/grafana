package v0alpha1

#RuleSearchSortField: "title" | "-title" | "group" | "-group" @cog(kind="enum",memberNames="TitleAsc|TitleDesc|GroupAsc|GroupDesc")

#RuleSearchType: "alertrule" | "recordingrule" @cog(kind="enum",memberNames="AlertRule|RecordingRule")

#RuleHit: {
	type:    #RuleSearchType
	name:    string
	title:   string
	folder:  string
	group?:  string
	paused?: bool
	labels?: [string]: string
	datasourceUIDs?: [...string]
}
