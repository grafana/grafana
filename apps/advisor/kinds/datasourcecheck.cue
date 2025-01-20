package advisor

datasourcecheck: {
	kind:       "DatasourceCheck"
	pluralName: "DatasourceChecks"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: false
				backend:  true
			}
			schema: {
				spec: {
					// Generic data input that a check can receive
					data?: [string]: string
				}
			}
		}
	}
}
