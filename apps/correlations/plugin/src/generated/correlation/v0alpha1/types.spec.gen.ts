// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface DataSourceRef {
	// same as pluginId
	group: string;
	// same as grafana uid
	name: string;
}

export const defaultDataSourceRef = (): DataSourceRef => ({
	group: "",
	name: "",
});

// there was a deprecated field here called type, we will need to move that for conversion and provisioning
export interface ConfigSpec {
	field: string;
	target: TargetSpec;
	transformations?: TransformationSpec[];
}

export const defaultConfigSpec = (): ConfigSpec => ({
	field: "",
	target: defaultTargetSpec(),
});

export type TargetSpec = Record<string, any>;

export const defaultTargetSpec = (): TargetSpec => ({});

export interface TransformationSpec {
	type: string;
	expression: string;
	field: string;
	mapValue: string;
}

export const defaultTransformationSpec = (): TransformationSpec => ({
	type: "",
	expression: "",
	field: "",
	mapValue: "",
});

export enum CorrelationType {
	Query = "query",
	External = "external",
}

export const defaultCorrelationType = (): CorrelationType => (CorrelationType.Query);

export interface Spec {
	source_ds_ref: DataSourceRef;
	target_ds_ref?: DataSourceRef;
	label: string;
	description?: string;
	config: ConfigSpec;
	provisioned: boolean;
	type: CorrelationType;
}

export const defaultSpec = (): Spec => ({
	source_ds_ref: defaultDataSourceRef(),
	label: "",
	config: defaultConfigSpec(),
	provisioned: false,
	type: CorrelationType.Query,
});

