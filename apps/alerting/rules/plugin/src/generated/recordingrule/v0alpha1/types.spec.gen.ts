// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface IntervalTrigger {
	interval: PromDuration;
}

export const defaultIntervalTrigger = (): IntervalTrigger => ({
	interval: defaultPromDuration(),
});

export type PromDuration = string;

export const defaultPromDuration = (): PromDuration => ("");

export type TemplateString = string;

export const defaultTemplateString = (): TemplateString => ("");

export type MetricName = string;

export const defaultMetricName = (): MetricName => ("");

export type ExpressionMap = Record<string, Expression>;

export const defaultExpressionMap = (): ExpressionMap => ({});

export interface Expression {
	queryType?: string;
	relativeTimeRange?: RelativeTimeRange;
	datasourceUID?: DatasourceUID;
	model: any;
	source?: boolean;
}

export const defaultExpression = (): Expression => ({
	model: {},
});

export interface RelativeTimeRange {
	from: PromDurationWMillis;
	to: PromDurationWMillis;
}

export const defaultRelativeTimeRange = (): RelativeTimeRange => ({
	from: defaultPromDurationWMillis(),
	to: defaultPromDurationWMillis(),
});

export type PromDurationWMillis = string;

export const defaultPromDurationWMillis = (): PromDurationWMillis => ("");

export type DatasourceUID = string;

export const defaultDatasourceUID = (): DatasourceUID => ("");

export interface Spec {
	title: string;
	paused?: boolean;
	trigger: IntervalTrigger;
	labels?: Record<string, TemplateString>;
	metric: MetricName;
	expressions: ExpressionMap;
	targetDatasourceUID: DatasourceUID;
}

export const defaultSpec = (): Spec => ({
	title: "",
	trigger: defaultIntervalTrigger(),
	metric: defaultMetricName(),
	expressions: defaultExpressionMap(),
	targetDatasourceUID: defaultDatasourceUID(),
});

