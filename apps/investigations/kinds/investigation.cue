package investigations

investigationV0alpha1: {
	kind:       "Investigation"
	pluralName: "Investigations"
	schema: {
		spec: {
			title:         string
			createdByProfile: #Person
			hasCustomName: bool
			isFavorite:    bool
			overviewNote:  string
			overviewNoteUpdatedAt: string
			collectables: [...#Collectable] // +listType=atomic
			viewMode:      #ViewMode
		}
	}
}

// Type definition for investigation summaries
#InvestigationSummary: {
	title:         string
	createdByProfile: #Person
	hasCustomName: bool
	isFavorite:    bool
	overviewNote:  string
	overviewNoteUpdatedAt: string
	viewMode:      #ViewMode
	collectableSummaries: [...#CollectableSummary] // +listType=atomic
}

// Person represents a user profile with basic information
#Person: {
    uid: string        // Unique identifier for the user
    name: string       // Display name of the user
    gravatarUrl: string // URL to user's Gravatar image
}

#ViewMode: {
	mode:         "compact" | "full"
	showComments: bool
	showTooltips: bool
} 
