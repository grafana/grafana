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
	type: "regex" | "logfmt";
	expression: string;
	field: string;
	mapValue: string;
}

export const defaultTransformationSpec = (): TransformationSpec => ({
	type: "regex",
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
	description?: string;
	label: string;
	source: DataSourceRef;
	target?: DataSourceRef;
	config: ConfigSpec;
	type: CorrelationType;
}

export const defaultSpec = (): Spec => ({
	label: "",
	source: defaultDataSourceRef(),
	config: defaultConfigSpec(),
	type: CorrelationType.Query,
});

