package plugincatalog

pluginV0Alpha1: {
	kind:   "Plugin"
	plural: "plugins"
	scope:  "Cluster"
	schema: {
		spec: {
			// Slug is the plugin identifier (e.g., "grafana-clock-panel")
			slug: string
			// Status is the plugin status from grafana.com ("active" or "enterprise")
			status: string
			// SignatureType is the plugin signature type
			signatureType: string
		}
	}
}
