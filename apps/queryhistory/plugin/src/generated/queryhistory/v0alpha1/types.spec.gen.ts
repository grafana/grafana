// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	// Primary datasource UID
	datasourceUid: string;
	// Opaque JSON blob of DataQuery objects
	queries: any;
	// User-editable comment
	comment?: string;
}

export const defaultSpec = (): Spec => ({
	datasourceUid: "",
	queries: {},
});

