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
	paused?: boolean;
	data: Record<string, Query>;
	interval: PromDuration;
	noDataState: string;
	execErrState: string;
	notificationSettings?: {
		receiver: string;
		groupBy?: string[];
		groupWait?: string;
		groupInterval?: string;
		repeatInterval?: string;
		muteTimeIntervals?: MuteTimeIntervalRef[];
		activeTimeIntervals?: ActiveTimeIntervalRef[];
	};
	for: string;
	keepFiringFor: string;
	missingSeriesEvalsToResolve?: number;
	annotations: Record<string, TemplateString>;
	dashboardUID?: string;
	labels: Record<string, TemplateString>;
	panelID?: number;
}

export const defaultSpec = (): Spec => ({
	title: "",
	data: {},
	interval: defaultPromDuration(),
	noDataState: "NoData",
	execErrState: "Error",
	for: "",
	keepFiringFor: "",
	annotations: {},
	labels: {},
});

