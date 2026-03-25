// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	defaultFields: string[];
	logLineDisplayMode?: 'full' | 'summary';
	prettifyJSON: boolean;
	wrapLogMessage: boolean;
	interceptDismissed: boolean;
}

export const defaultSpec = (): Spec => ({
	defaultFields: [],
	prettifyJSON: false,
	wrapLogMessage: false,
	interceptDismissed: false,
});

