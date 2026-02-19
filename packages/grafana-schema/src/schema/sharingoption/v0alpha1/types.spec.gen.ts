// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	// Snapshot title
	snapshotsEnabled?: boolean;
	// The external URL where the snapshot can be pushed
	externalSnapshotURL?: string;
	// The external name of the snapshot in the remote server
	externalSnapshotName?: string;
	// External snapshots feature enabled
	externalEnabled?: boolean;
}

export const defaultSpec = (): Spec => ({
	snapshotsEnabled: false,
	externalEnabled: false,
});

