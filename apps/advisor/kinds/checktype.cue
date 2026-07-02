package advisor

checktypev0alpha1: {
	kind:   "CheckType"
	plural: "checktypes"
	scope:  "Namespaced"
	schema: {
		#Step: {
			title:           string
			// i18n key for the title. Frontend uses this with @grafana/i18n's t(key, fallback).
			titleKey?:       string
			description:     string
			// i18n key for the description.
			descriptionKey?: string
			stepID:          string
			resolution:      string
			// i18n key for the resolution.
			resolutionKey?:  string
		}
		spec: {
			name: string
			steps: [...#Step]
		}
	}
}
