package kinds

// This is our Investigation definition, which contains metadata about the kind, and the kind's schema
investigation: {
	group:      "investigation"
	kind:       "Investigation"
	pluralName: "Investigations"
	scope:      "Namespaced"

	apiResource: {
		groupOverride: "investigation.grafana.app"
	}

	codegen: {
		frontend: false
		backend:  true
	}

	current: "v1alpha1"
	versions: {
		"v1alpha1": {
			version: "v1alpha1"
			schema: {
				// spec is the schema of our resource. The spec should include all the user-ediable information for the kind.
				spec: {
					title: string
				}
			}
		}
	}
}
