package kinds

snapshotV0alpha1: {
	kind:       "Snapshot"
	pluralName: "Snapshots"

	// Generic read routes bypass the ownership filtering used by snapshot lists.
	listKeys: false
	search: {
		endpoint: false
	}
	schema: {
		spec: {
			// Snapshot title
			title?: string

			// Optionally auto-remove the snapshot at a future date (Unix timestamp in seconds)
			expires?: int64 | *0

			// When set to true, the snapshot exists in a remote server
			external?: bool | *false

			// The external URL where the snapshot can be seen
			externalUrl?: string

			// The server-provided URL for deleting the external snapshot
			externalDeleteUrl?: string

			// The URL that created the dashboard originally
			originalUrl?: string

			// Snapshot creation timestamp
			timestamp?: string

			// Snapshot delete key
			deleteKey?: string

			// The raw dashboard (unstructured for now)
			dashboard?: [string]: _
		}
		blobs: {
			dashboard?: #BlobReference
		}
	}
}

#BlobReference: {
	uid:          string
	size?:        int64
	hash?:        string
	contentType?: string
}
