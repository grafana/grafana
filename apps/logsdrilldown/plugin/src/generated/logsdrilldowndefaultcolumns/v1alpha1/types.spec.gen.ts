// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type LogsDefaultColumnsDatasource = {
	records: LogsDefaultColumnsRecords;
}[];

export const defaultLogsDefaultColumnsDatasource = (): LogsDefaultColumnsDatasource => ([]);

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

