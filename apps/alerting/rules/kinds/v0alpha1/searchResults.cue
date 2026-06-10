package v0alpha1

#RuleSearchSortField: "title" | "-title" | "group" | "-group" @cog(kind="enum",memberNames="TitleAsc|TitleDesc|GroupAsc|GroupDesc")

#AlertRuleHit: {
	metadata: _
	spec:     #AlertRuleSpec
}

#RecordingRuleHit: {
	metadata: _
	spec:     #RecordingRuleSpec
}

#RuleHit: {
	metadata: _
	spec:     #AlertRuleSpec | #RecordingRuleSpec
}
