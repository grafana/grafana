package folder

pendingFolderDeletionsV1: {
	kind:       "PendingFolderDeletion"
	pluralName: "PendingFolderDeletions"
	// Recovery reads and lists internal intents directly; they aren't searchable content.
	search: {
		endpoint: false
	}
	schema: {
		spec: {
			folderName: string
			folderUID:  string
			// Captured from the folder's deletionTimestamp to measure actual deletion duration.
			// The entry's metadata.creationTimestamp records intent before deletion is attempted;
			// a failed or timed-out request may leave intent without starting deletion.
			// Using that creation time would include the wait before deletion begins.
			// Optional because the folder's deletion timestamp is not yet known when intent is recorded.
			deletionTimestamp?: string
		}
	}
}
