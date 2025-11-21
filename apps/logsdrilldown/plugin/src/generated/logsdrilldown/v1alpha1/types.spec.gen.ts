// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface LogsDefaultColumns {
	datasource: {
		dsUID: string;
		records: {
			columns: string[];
			labels: {
				key: string;
				value: string;
			}[];
		}[];
	}[];
}

export const defaultLogsDefaultColumns = (): LogsDefaultColumns => ({
	datasource: [],
});

export interface Spec {
	defaultFields: string[];
	prettifyJSON: boolean;
	wrapLogMessage: boolean;
	interceptDismissed: boolean;
	defaultColumns: LogsDefaultColumns;
}

export const defaultSpec = (): Spec => ({
	defaultFields: [],
	prettifyJSON: false,
	wrapLogMessage: false,
	interceptDismissed: false,
	defaultColumns: defaultLogsDefaultColumns(),
});

