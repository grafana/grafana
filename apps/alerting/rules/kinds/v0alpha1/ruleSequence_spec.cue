package v0alpha1

RuleSequenceSpec: {
	trigger: #IntervalTrigger
	recordingRules: [...#RuleRef]
	alertingRules?: [...#RuleRef]
}

#RuleRef: {
	name: #RuleUID
}

#RuleUID: string & =~"^[a-zA-Z0-9_-]+$"
