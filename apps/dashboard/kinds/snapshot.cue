package kinds

snapshotV0alpha1: {
	kind:       "Snapshot"
	pluralName: "Snapshots"
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

			// The URL that created the dashboard originally
			originalUrl?: string

			// Snapshot creation timestamp
			timestamp?: string

			// Snapshot delete key
			deleteKey?: string

			// The raw dashboard (unstructured for now)
			dashboard?: [string]: _

			// The dashboard payload encrypted at rest. Persisted in unified storage
			// in place of `dashboard`. The envelope is produced by the app-platform
			// EncryptionManager, which is namespace-scoped: dataKeyId identifies the
			// per-namespace data encryption key used to produce encryptedData.
			// Clients should not set this directly; it is populated by the storage
			// layer.
			dashboardEncrypted?: {
				dataKeyId:     string
				encryptedData: bytes
			}
		}
	}
}
