// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// TODO: validate that only one can specify source=true
// & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per
export type QueryMap = Record<string, Query>;

export const defaultQueryMap = (): QueryMap => ({});

// TODO: come up with a better name for this. We have expression type things and data source queries
export interface Query {
	// TODO: consider making this optional, with the nil value meaning "__expr__" (i.e. expression query)
	queryType: string;
	relativeTimeRange?: RelativeTimeRange;
	datasourceUID: DatasourceUID;
	model: any;
	source?: boolean;
}

export const defaultQuery = (): Query => ({
	queryType: "",
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

// TODO(@moustafab): validate regex for time interval ref
export type TimeIntervalRef = string;

export const defaultTimeIntervalRef = (): TimeIntervalRef => ("");

export type TemplateString = string;

export const defaultTemplateString = (): TemplateString => ("");

export interface Spec {
	title: string;
	data: QueryMap;
	paused?: boolean;
	trigger: IntervalTrigger;
	noDataState: string;
	execErrState: string;
	for?: string;
	keepFiringFor?: string;
	missingSeriesEvalsToResolve?: number;
	notificationSettings?: {
		receiver: string;
		groupBy?: string[];
		groupWait?: PromDuration;
		groupInterval?: PromDuration;
		repeatInterval?: PromDuration;
		muteTimeIntervals?: TimeIntervalRef[];
		activeTimeIntervals?: TimeIntervalRef[];
	};
	annotations?: Record<string, TemplateString>;
	labels?: Record<string, TemplateString>;
	panelRef?: {
		dashboardUID: string;
		panelID: number;
	};
}

export const defaultSpec = (): Spec => ({
	title: "",
	data: defaultQueryMap(),
	trigger: defaultIntervalTrigger(),
	noDataState: "NoData",
	execErrState: "Error",
});

