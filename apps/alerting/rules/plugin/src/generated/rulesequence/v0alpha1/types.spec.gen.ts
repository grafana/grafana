// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface IntervalTrigger {
	interval: PromDuration;
}

export const defaultIntervalTrigger = (): IntervalTrigger => ({
	interval: defaultPromDuration(),
});

export type PromDuration = string;

export const defaultPromDuration = (): PromDuration => ("");

export interface RuleRef {
	uid: RuleUID;
}

export const defaultRuleRef = (): RuleRef => ({
	uid: defaultRuleUID(),
});

export type RuleUID = string;

export const defaultRuleUID = (): RuleUID => ("");

export interface Spec {
	trigger: IntervalTrigger;
	// Non-empty constraint is enforced in Go admission validation (validator.go),
	// not in CUE. Using [...#RuleRef] instead of [#RuleRef, ...#RuleRef] avoids
	// a codegen bug where the CUE default generates invalid Go/TS defaults
	// (empty-UID RuleRef in Go, `uid: <nil>` in TypeScript).
	recordingRules: RuleRef[];
	alertingRules?: RuleRef[];
}

export const defaultSpec = (): Spec => ({
	trigger: defaultIntervalTrigger(),
	recordingRules: [],
});

