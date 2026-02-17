// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type LogsLogsDefaultLabelsRecords = LogsLogsDefaultLabelsRecord[];

export const defaultLogsLogsDefaultLabelsRecords = (): LogsLogsDefaultLabelsRecords => ([]);

export interface LogsLogsDefaultLabelsRecord {
	dsUid: string;
	labels: string[];
}

export const defaultLogsLogsDefaultLabelsRecord = (): LogsLogsDefaultLabelsRecord => ({
	dsUid: "",
	labels: [],
});

export interface Spec {
	records: LogsLogsDefaultLabelsRecords;
}

export const defaultSpec = (): Spec => ({
	records: defaultLogsLogsDefaultLabelsRecords(),
});

