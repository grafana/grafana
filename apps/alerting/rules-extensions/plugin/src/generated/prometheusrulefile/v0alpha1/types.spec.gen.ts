// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type DatasourceUID = string;

export const defaultDatasourceUID = (): DatasourceUID => ("");

export interface PrometheusRuleGroup {
	name: string;
	interval?: PromDuration;
	queryOffset?: PromDuration;
	limit?: number;
	labels?: Record<string, string>;
	rules: RuleEntry[];
}

export const defaultPrometheusRuleGroup = (): PrometheusRuleGroup => ({
	name: "",
	rules: [],
});

export type PromDuration = string;

export const defaultPromDuration = (): PromDuration => ("");

export interface RuleEntry {
	expr: string;
	for?: PromDuration;
	keepFiringFor?: PromDuration;
	labels?: Record<string, string>;
	annotations?: Record<string, string>;
	record?: string;
	alert?: string;
}

export const defaultRuleEntry = (): RuleEntry => ({
	expr: "",
});

export interface Spec {
	datasourceUID?: DatasourceUID;
	groups: PrometheusRuleGroup[];
}

export const defaultSpec = (): Spec => ({
	groups: [],
});

