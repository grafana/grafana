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
				spec: #CheckData
				status: {
					report: #CheckReport
				}
			}
		}
	}
}
