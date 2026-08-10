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
	// name is the metadata.name of an AlertRule or RecordingRule resource.
	name: RuleUID;
}

export const defaultRuleRef = (): RuleRef => ({
	name: defaultRuleUID(),
});

export type RuleUID = string;

export const defaultRuleUID = (): RuleUID => ("");

export interface Spec {
	trigger: IntervalTrigger;
	recordingRules: RuleRef[];
	alertingRules?: RuleRef[];
}

export const defaultSpec = (): Spec => ({
	trigger: defaultIntervalTrigger(),
	recordingRules: [],
});

