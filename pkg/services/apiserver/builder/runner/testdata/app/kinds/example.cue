package core

externalName: {
	kind: "Example"
	group: "example"
	apiResource: {
		groupOverride: "example.grafana.app"
	}
	codegen: {
		frontend: false
		backend: true
	}
	pluralName: "Examples"
	current: "v1"
	versions: {
		"v1": {
			schema: {
				spec: {
					a: string
                    b: string
				}
			}
		}
	}
}
