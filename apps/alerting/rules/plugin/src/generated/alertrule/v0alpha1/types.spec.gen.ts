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

export enum NoDataState {
	NoData = "NoData",
	Ok = "Ok",
	Alerting = "Alerting",
	KeepLast = "KeepLast",
}

export const defaultNoDataState = (): NoDataState => (NoDataState.NoData);

export enum ExecErrState {
	Error = "Error",
	Ok = "Ok",
	Alerting = "Alerting",
	KeepLast = "KeepLast",
}

export const defaultExecErrState = (): ExecErrState => (ExecErrState.Error);

// TODO(@moustafab): this should be imported from the notifications package
export type NotificationSettings = SimplifiedRouting | NamedRoutingTree;

export const defaultNotificationSettings = (): NotificationSettings => (defaultSimplifiedRouting());

export interface SimplifiedRouting {
	type: NotificationSettingsType.SimplifiedRouting;
	receiver: string;
	groupBy?: string[];
	groupWait?: PromDuration;
	groupInterval?: PromDuration;
	repeatInterval?: PromDuration;
	muteTimeIntervals?: TimeIntervalRef[];
	activeTimeIntervals?: TimeIntervalRef[];
}

export const defaultSimplifiedRouting = (): SimplifiedRouting => ({
	type: NotificationSettingsType.SimplifiedRouting,
	receiver: "",
});

export enum NotificationSettingsType {
	SimplifiedRouting = "SimplifiedRouting",
	NamedRoutingTree = "NamedRoutingTree",
}

export const defaultNotificationSettingsType = (): NotificationSettingsType => (NotificationSettingsType.SimplifiedRouting);

// TODO(@moustafab): validate regex for time interval ref
export type TimeIntervalRef = string;

export const defaultTimeIntervalRef = (): TimeIntervalRef => ("");

export interface NamedRoutingTree {
	type: NotificationSettingsType.NamedRoutingTree;
	routingTree: string;
}

export const defaultNamedRoutingTree = (): NamedRoutingTree => ({
	type: NotificationSettingsType.NamedRoutingTree,
	routingTree: "",
});

// TODO: validate that only one can specify source=true
// & struct.MinFields(1) This doesn't work in Cue <v0.12.0 as per
export type ExpressionMap = Record<string, Expression>;

export const defaultExpressionMap = (): ExpressionMap => ({});

export interface Expression {
	// The type of query if this is a query expression
	queryType?: string;
	relativeTimeRange?: RelativeTimeRange;
	// The UID of the datasource to run this expression against. If omitted, the expression will be run against the `__expr__` datasource
	datasourceUID?: DatasourceUID;
	model: any;
	// Used to mark the expression to be used as the final source for the rule evaluation
	// Only one expression in a rule can be marked as the source
	// For AlertRules, this is the expression that will be evaluated against the alerting condition
	// For RecordingRules, this is the expression that will be recorded
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

export interface PanelRef {
	dashboardUID: string;
	panelID: number;
}

export const defaultPanelRef = (): PanelRef => ({
	dashboardUID: "",
	panelID: 0,
});

export interface Spec {
	title: string;
	paused?: boolean;
	trigger: IntervalTrigger;
	labels?: Record<string, TemplateString>;
	annotations?: Record<string, TemplateString>;
	for?: string;
	keepFiringFor?: string;
	missingSeriesEvalsToResolve?: number;
	noDataState: NoDataState;
	execErrState: ExecErrState;
	notificationSettings?: NotificationSettings;
	expressions: ExpressionMap;
	panelRef?: PanelRef;
}

export const defaultSpec = (): Spec => ({
	title: "",
	trigger: defaultIntervalTrigger(),
	noDataState: NoDataState.NoData,
	execErrState: ExecErrState.Error,
	expressions: defaultExpressionMap(),
});

