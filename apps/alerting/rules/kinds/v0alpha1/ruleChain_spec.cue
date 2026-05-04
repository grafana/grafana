package v0alpha1

RuleChainSpec: {
	trigger: #IntervalTrigger
	// Non-empty constraint is enforced in Go admission validation (validator.go),
	// not in CUE. Using [...#RuleRef] instead of [#RuleRef, ...#RuleRef] avoids
	// a codegen bug where the CUE default generates invalid Go/TS defaults
	// (empty-UID RuleRef in Go, `uid: <nil>` in TypeScript).
	recordingRules: [...#RuleRef]
	alertingRules?: [...#RuleRef]
}

#RuleRef: {
	uid: #RuleUID
}

#RuleUID: string & =~"^[a-zA-Z0-9_-]+$"
