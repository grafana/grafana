// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type LogsLogsDefaultLabelsRecords = LogsLogsDefaultLabelsRecord[];

export const defaultLogsLogsDefaultLabelsRecords = (): LogsLogsDefaultLabelsRecords => ([]);

export interface LogsLogsDefaultLabelsRecord {
	labels: string[];
}

export const defaultLogsLogsDefaultLabelsRecord = (): LogsLogsDefaultLabelsRecord => ({
	labels: [],
});

export interface Spec {
	records: LogsLogsDefaultLabelsRecords;
}

export const defaultSpec = (): Spec => ({
	records: defaultLogsLogsDefaultLabelsRecords(),
});

