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

export interface IntervalTrigger {
	interval: PromDuration;
}

export const defaultIntervalTrigger = (): IntervalTrigger => ({
	interval: defaultPromDuration(),
});

export type PromDuration = string;

export const defaultPromDuration = (): PromDuration => ("");

// TODO(@moustafab): validate regex for mute time interval ref
export type MuteTimeIntervalRef = string;

export const defaultMuteTimeIntervalRef = (): MuteTimeIntervalRef => ("");

// TODO(@moustafab): validate regex for active time interval ref
export type ActiveTimeIntervalRef = string;

export const defaultActiveTimeIntervalRef = (): ActiveTimeIntervalRef => ("");

// =~ figure out the regex for the template string
export type TemplateString = string;

export const defaultTemplateString = (): TemplateString => ("");

export interface Spec {
	title: string;
	data: Record<string, Query>;
	paused?: boolean;
	trigger: IntervalTrigger;
	noDataState: string;
	execErrState: string;
	for: string;
	keepFiringFor: string;
	missingSeriesEvalsToResolve?: number;
	notificationSettings?: {
		receiver: string;
		groupBy?: string[];
		groupWait?: string;
		groupInterval?: string;
		repeatInterval?: string;
		muteTimeIntervals?: MuteTimeIntervalRef[];
		activeTimeIntervals?: ActiveTimeIntervalRef[];
	};
	annotations: Record<string, TemplateString>;
	labels: Record<string, TemplateString>;
	panelRef?: {
		dashboardUID: string;
		panelID: number;
	};
}

export const defaultSpec = (): Spec => ({
	title: "",
	data: {},
	trigger: defaultIntervalTrigger(),
	noDataState: "NoData",
	execErrState: "Error",
	for: "",
	keepFiringFor: "",
	annotations: {},
	labels: {},
});

