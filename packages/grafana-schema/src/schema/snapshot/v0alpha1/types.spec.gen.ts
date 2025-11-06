// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	// Snapshot title
	title?: string;
	// Optionally auto-remove the snapshot at a future date (Unix timestamp in seconds)
	expires?: number;
	// When set to true, the snapshot exists in a remote server
	external?: boolean;
	// The external URL where the snapshot can be seen
	externalUrl?: string;
	// The URL that created the dashboard originally
	originalUrl?: string;
	// Snapshot creation timestamp
	timestamp?: string;
	// The raw dashboard (unstructured for now)
	Dashboard?: Record<string, any>;
}

export const defaultSpec = (): Spec => ({
	expires: 0,
	external: false,
});

