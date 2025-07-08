// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Integration {
	uid?: string;
	type: string;
	disableResolveMessage?: boolean;
	settings: Record<string, any>;
	secureFields?: Record<string, boolean>;
}

export const defaultIntegration = (): Integration => ({
	type: "",
	settings: {},
});

export interface Spec {
	title: string;
	integrations: Integration[];
}

export const defaultSpec = (): Spec => ({
	title: "",
	integrations: [],
});

