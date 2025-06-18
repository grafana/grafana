// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Query {
	queryType: string;
	relativeTimeRange: RelativeTimeRange;
	datasourceUID: DatasourceUID;
	model: any;
	source?: boolean;
}

export const defaultQuery = (): Query => ({
	queryType: "",
	relativeTimeRange: defaultRelativeTimeRange(),
	datasourceUID: defaultDatasourceUID(),
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

// TODO(@moustafab): validate regex for datasource UID
export type DatasourceUID = string;

export const defaultDatasourceUID = (): DatasourceUID => ("");

export type PromDuration = string;

export const defaultPromDuration = (): PromDuration => ("");

// =~ figure out the regex for the template string
export type TemplateString = string;

export const defaultTemplateString = (): TemplateString => ("");

export interface Spec {
	title: string;
	paused?: boolean;
	data: Record<string, Query>;
	interval: PromDuration;
	metric: string;
	labels: Record<string, TemplateString>;
	targetDatasourceUID: string;
}

export const defaultSpec = (): Spec => ({
	title: "",
	data: {},
	interval: defaultPromDuration(),
	metric: "",
	labels: {},
	targetDatasourceUID: "",
});

