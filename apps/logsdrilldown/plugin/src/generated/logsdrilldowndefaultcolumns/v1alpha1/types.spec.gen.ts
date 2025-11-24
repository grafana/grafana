// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface LogsDefaultColumnsDatasource {
	records: LogsDefaultColumnsRecords;
}

export const defaultLogsDefaultColumnsDatasource = (): LogsDefaultColumnsDatasource => ({
	records: defaultLogsDefaultColumnsRecords(),
});

export type LogsDefaultColumnsRecords = {
	columns: string[];
	labels: LogsDefaultColumnsLabels;
}[];

export const defaultLogsDefaultColumnsRecords = (): LogsDefaultColumnsRecords => ([]);

export type LogsDefaultColumnsLabels = {
	key: string;
	value: string;
}[];

export const defaultLogsDefaultColumnsLabels = (): LogsDefaultColumnsLabels => ([]);

export interface Spec {
	datasource: LogsDefaultColumnsDatasource;
}

export const defaultSpec = (): Spec => ({
	datasource: defaultLogsDefaultColumnsDatasource(),
});

