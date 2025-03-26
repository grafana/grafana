package investigations

investigationIndex: {
	kind:       "InvestigationIndex"
	pluralName: "InvestigationIndexes"

	codegen: {
		ts: {
			enabled: true
		}
		go: {
			enabled: true
		}
	}

	current: "v0alpha1"
	versions: {
		"v0alpha1": {
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
