// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type LogsDefaultColumnsRecords = LogsDefaultColumnsRecord[];

export const defaultLogsDefaultColumnsRecords = (): LogsDefaultColumnsRecords => ([]);

export interface LogsDefaultColumnsRecord {
	columns: string[];
	labels: LogsDefaultColumnsLabels;
}

export const defaultLogsDefaultColumnsRecord = (): LogsDefaultColumnsRecord => ({
	columns: [],
	labels: defaultLogsDefaultColumnsLabels(),
});

export type LogsDefaultColumnsLabels = LogsDefaultColumnsLabel[];

export const defaultLogsDefaultColumnsLabels = (): LogsDefaultColumnsLabels => ([]);

export interface LogsDefaultColumnsLabel {
	key: string;
	value: string;
}

export const defaultLogsDefaultColumnsLabel = (): LogsDefaultColumnsLabel => ({
	key: "",
	value: "",
});

export interface Spec {
	records: LogsDefaultColumnsRecords;
}

export const defaultSpec = (): Spec => ({
	records: defaultLogsDefaultColumnsRecords(),
});

