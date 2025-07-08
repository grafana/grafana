package investigations

// InvestigationIndex kind definition matching the new app-sdk structure
investigationIndexv0alpha1: {
	kind:   "InvestigationIndex"
	plural: "investigationindexes"
	scope:  "Namespaced"
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
