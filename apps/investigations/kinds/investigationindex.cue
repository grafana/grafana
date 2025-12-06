package investigations

investigationIndexV0alpha1:{
	kind:       "InvestigationIndex"
	pluralName: "InvestigationIndexes"
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
