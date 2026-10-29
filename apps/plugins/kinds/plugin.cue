package plugins

pluginV0Alpha1: {
	kind:   "Plugin"
	plural: "plugins"
	scope:  "Namespaced"

	// Plugins are read from the running instance rather than unified storage, so
	// a search would always come back empty.
	search: {
		endpoint: false
	}
	schema: {
		spec: {
			id:        string
			version:   string
			url?:      string
			parentId?: string
		}
	}
}
