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
