// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface ConfigSpec {
	field: string;
	type?: string;
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
	source_uid: string;
	target_uid?: string;
	label: string;
	description?: string;
	config: ConfigSpec;
	provisioned: boolean;
	type: CorrelationType;
}

export const defaultSpec = (): Spec => ({
	source_uid: "",
	label: "",
	config: defaultConfigSpec(),
	provisioned: false,
	type: CorrelationType.Query,
});

