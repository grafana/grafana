package plugins

pluginV0Alpha1: {
	kind:   "Plugin"
	plural: "plugins"
	scope:  "Namespaced"
	schema: {
		spec: {
			id:      string
			version: string
			url?:    string
			class:   "core" | "external"
		}
	}
}
