// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	// Text of the annotation.
	text: string;
	// Start time of the annotation, in Unix milliseconds.
	time: number;
	// End time of the annotation, in Unix milliseconds.
	// Optional. Set it to make the annotation a region.
	timeEnd?: number;
	// UID of the dashboard the annotation belongs to.
	// Optional. Omit it for an organization-wide annotation.
	dashboardUID?: string;
	// ID of the panel the annotation belongs to, within the dashboard set by dashboardUID.
	// Optional. Omit it to show the annotation on every panel of the dashboard.
	panelID?: number;
	// Tags used to categorize and filter annotations.
	tags?: string[];
	// Names of the scopes the annotation applies to.
	scopes?: string[];
}

export const defaultSpec = (): Spec => ({
	text: "",
	time: 0,
});

