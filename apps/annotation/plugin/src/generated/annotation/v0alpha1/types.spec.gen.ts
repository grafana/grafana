// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	// Text of the annotation.
	text: string;
	// Start time of the annotation, in milliseconds since the Unix epoch.
	time: number;
	// End time of the annotation, in milliseconds since the Unix epoch.
	// Set it to make the annotation a region. Omit it, or set it to the same value as time, for a point-in-time annotation.
	timeEnd?: number;
	// UID of the dashboard the annotation belongs to. Omit it for an organization-wide annotation.
	dashboardUID?: string;
	// ID of the panel the annotation belongs to, within the dashboard set by dashboardUID.
	// Omit it to show the annotation on every panel of the dashboard.
	panelID?: number;
	// Tags used to categorize and filter annotations.
	tags?: string[];
	// Names of the scopes the annotation applies to. The server limits how many scopes an annotation can have (5 by default).
	scopes?: string[];
}

export const defaultSpec = (): Spec => ({
	text: "",
	time: 0,
});

