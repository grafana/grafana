// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface QueryInfo {
	refId: string;
	datasource: DataSourceRef;
	// the
	properties: any;
}

export const defaultQueryInfo = (): QueryInfo => ({
	refId: "",
	datasource: defaultDataSourceRef(),
	properties: {},
});

export interface DataSourceRef {
	// same as pluginId
	group: string;
	// apiversion
	version: string;
	// same as grafana uid
	name: string;
}

export const defaultDataSourceRef = (): DataSourceRef => ({
	group: "",
	version: "",
	name: "",
});

export interface Spec {
	comment?: string;
	queries: QueryInfo[];
}

export const defaultSpec = (): Spec => ({
	queries: [],
});

