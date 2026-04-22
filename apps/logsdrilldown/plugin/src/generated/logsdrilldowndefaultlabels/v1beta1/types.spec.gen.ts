// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type LogsLogsDefaultLabelsRecords = LogsLogsDefaultLabelsRecord[];

export const defaultLogsLogsDefaultLabelsRecords = (): LogsLogsDefaultLabelsRecords => ([]);

export interface LogsLogsDefaultLabelsRecord {
	label: string;
	values: string[];
}

export const defaultLogsLogsDefaultLabelsRecord = (): LogsLogsDefaultLabelsRecord => ({
	label: "",
	values: [],
});

export interface Spec {
	records: LogsLogsDefaultLabelsRecords;
}

export const defaultSpec = (): Spec => ({
	records: defaultLogsLogsDefaultLabelsRecords(),
});

