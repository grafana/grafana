package v0alpha1

RuleSequenceSpec: {
	trigger: #IntervalTrigger
	// FIXME: Non-empty constraint is enforced in Go admission validation (validator.go),
	// not in CUE, because list.MinItems on a struct-typed list causes a codegen
	// error in grafana-app-sdk ("unexpected node with kind '_|_'").

	recordingRules: [...#RuleRef]
	alertingRules?: [...#RuleRef]
}

#RuleRef: {
	// name is the metadata.name of an AlertRule or RecordingRule resource.
	name: #RuleUID
}

#RuleUID: string & =~"^[a-zA-Z0-9_-]+$"
