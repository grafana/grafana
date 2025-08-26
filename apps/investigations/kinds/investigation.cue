package investigations

// This is our Investigation definition, which contains metadata about the kind, and the kind's schema
investigation: {
	kind:       "Investigation"
	group:      "investigations.grafana.app"
	apiResource: {
		groupOverride: "investigations.grafana.app"
	}
	pluralName: "Investigations"
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
				// spec is the schema of our resource
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
