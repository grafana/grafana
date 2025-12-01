// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type TemplateSpec = Record<string, DataSourceTemplateSpec>;

export const defaultTemplateSpec = (): TemplateSpec => ({});

export interface DataSourceTemplateSpec {
	// type
	group: string;
	// variable name / display name
	name: string;
}

export const defaultDataSourceTemplateSpec = (): DataSourceTemplateSpec => ({
	group: "",
	name: "",
});

export interface Mode {
	name: string;
	uid: string;
	definition: ModeSpec;
}

export const defaultMode = (): Mode => ({
	name: "",
	uid: "",
	definition: defaultModeSpec(),
});

export type ModeSpec = Record<string, DataSourceRef>;

export const defaultModeSpec = (): ModeSpec => ({});

export interface DataSourceRef {
	// grafana data source uid
	name: string;
}

export const defaultDataSourceRef = (): DataSourceRef => ({
	name: "",
});

export interface Spec {
	template: TemplateSpec;
	modes: Mode[];
}

export const defaultSpec = (): Spec => ({
	template: defaultTemplateSpec(),
	modes: [],
});

