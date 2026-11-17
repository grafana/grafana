package folder

// Pending metadata.name is <folder.metadata.name>-<folder.metadata.uid>, using
// the exact API name and Kubernetes incarnation UID, never the display title.
// Unsupported names or names exceeding 253 bytes fail closed without alteration.
pendingFolderDeletionsV1alpha1: {
	kind:       "PendingFolderDeletion"
	pluralName: "PendingFolderDeletions"
	// Recovery reads and lists internal intents directly; they aren't searchable content.
	search: {
		endpoint: false
	}
	schema: {
		spec: {
			// Folder metadata.name: the legacy Grafana folder UID, not the display title.
			folderName: string
			// Folder Kubernetes metadata.uid identifies this incarnation; appended to folderName with a hyphen for pending metadata.name.
			folderUID: string
			// Captured from the folder's deletionTimestamp to measure actual deletion duration.
			// The entry's metadata.creationTimestamp records intent before deletion is attempted;
			// a failed or timed-out request may leave intent without starting deletion.
			// Using that creation time would include the wait before deletion begins.
			// Optional because the folder's deletion timestamp is not yet known when intent is recorded.
			deletionTimestamp?: string
		}
	}
}
