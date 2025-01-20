package advisor

check: {
	kind:       "Check"
	pluralName: "Checks"
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
