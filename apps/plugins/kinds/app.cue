package plugins

appV0Alpha1: {
	kind:   "App"
	plural: "apps"
	scope:  "Namespaced"
	schema: {
		spec: {
			enabled: bool
			pinned:  bool
		}
	}
}
