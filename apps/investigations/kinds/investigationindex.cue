package investigations

investigationIndex: {
	kind:       "InvestigationIndex"
	group:      "investigations.grafana.app"
	apiResource: {
		groupOverride: "investigations.grafana.app"
	}
	pluralName: "InvestigationIndexes"
	current:    "v0alpha1"
	versions: {
		"v0alpha1": {
			codegen: {
				frontend: true
				backend:  true
				options: {
					generateObjectMeta: true
					generateClient:     true
					k8sLike:           true
					package:           "github.com/grafana/grafana/apps/investigations"
				}
			}
			schema: {
				spec: {
					// Title of the index, e.g. 'Favorites' or 'My Investigations'
					title: string

					// The Person who owns this investigation index
					owner: #Person

					// Array of investigation summaries
					investigationSummaries: [...#InvestigationSummary] // +listType=atomic
				}
			}
		}
	}
}
