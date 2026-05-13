// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type PromDuration = string;

export const defaultPromDuration = (): PromDuration => ("");

export interface PrometheusRule {
	alert?: string;
	record?: string;
	expr: string;
	for?: PromDuration;
	keepFiringFor?: PromDuration;
	labels?: Record<string, string>;
	annotations?: Record<string, string>;
}

export const defaultPrometheusRule = (): PrometheusRule => ({
	expr: "",
});

export interface Spec {
	name: string;
	interval?: PromDuration;
	queryOffset?: PromDuration;
	limit?: number;
	labels?: Record<string, string>;
	rules: PrometheusRule[];
}

export const defaultSpec = (): Spec => ({
	name: "",
	rules: [],
});

