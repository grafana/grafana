// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export type TemplateSpec = Record<string, DataSourceStackTemplateItem>;

export const defaultTemplateSpec = (): TemplateSpec => ({});

export interface DataSourceStackTemplateItem {
	// type
	group: string;
	// variable name / display name
	name: string;
}

export const defaultDataSourceStackTemplateItem = (): DataSourceStackTemplateItem => ({
	group: "",
	name: "",
});

export interface ModeSpec {
	name: string;
	uid: string;
	definition: Mode;
}

export const defaultModeSpec = (): ModeSpec => ({
	name: "",
	uid: "",
	definition: defaultMode(),
});

export type Mode = Record<string, ModeItem>;

export const defaultMode = (): Mode => ({});

export interface ModeItem {
	// grafana data source uid
	dataSourceRef: string;
}

export const defaultModeItem = (): ModeItem => ({
	dataSourceRef: "",
});

export interface Spec {
	template: TemplateSpec;
	modes: ModeSpec[];
}

export const defaultSpec = (): Spec => ({
	template: defaultTemplateSpec(),
	modes: [],
});

