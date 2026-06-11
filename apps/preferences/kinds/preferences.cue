package preferences

preferencesV1alpha1: {
	kind:       "Preferences"
	pluralName: "Preferences"
	scope:      "Namespaced"

	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	schema: {
		spec: {
			// Explicit home URL (NOTE: this can only be modified in the system settings)
			homeURL?: string

			// UID for the home dashboard
			homeDashboardUID?: string

			// The timezone selection
			timezone?: string

			// day of the week (sunday, monday, etc)
			weekStart?: string

			// user interface theme
			theme?: string

			// Selected language
			language?: string

			// Explore query history preferences
			queryHistory?: #QueryHistoryPreference

			// Navigation preferences
			navbar?: #NavbarPreference
		}

		#QueryHistoryPreference: {
			// one of: '' | 'query' | 'starred';
			homeTab?: string
		}

		#NavbarPreference: {
			bookmarkUrls: [...string]
		}
	}
}
