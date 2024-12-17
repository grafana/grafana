package kinds

// This is our Investigation definition, which contains metadata about the kind, and the kind's schema
investigation: {
	// Name is the human-readable name which is used for generated type names.
	kind:  "Investigation"
	scope: "Namespaced"
	codegen: {
		frontend: false
		backend:  true
	}
	pluralName: "Investigations"
	current: "v1-alpha"
	versions: {
		"v1-alpha": {
			version: "v1-alpha"
			schema: {
				// spec is the schema of our resource. The spec should include all the user-ediable information for the kind.
				spec: {
				  title: string
				}
			}
		}
	}
}
