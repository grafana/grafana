package kinds

snapshot: {
	kind:       "Snapshot"
	pluralName: "Snapshots"
	scope:      "Namespaced"
	current:    "v0alpha1"
	
	codegen: {
		ts: {
			enabled: true
		}
		go: {
			enabled: true
		}
	}
	
	versions: {
		"v0alpha1": {
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

					// The raw dashboard (unstructured for now)
	        Dashboard?: [string]: _
				}
			}
		}
	}
}
