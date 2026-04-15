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
			// TODO: this should use the timezone defined in common
			timezone?: string

			// day of the week (sunday, monday, etc)
			weekStart?: string

			// light, dark, empty is default
			theme?: string

			// Selected language (beta)
			language?: string

			// Selected locale (beta)
			regionalFormat?: string

			// Explore query history preferences
			queryHistory?: #QueryHistoryPreference

			// Navigation preferences
			navbar?: #NavbarPreference

			// Bitwise flags that will hide help modals in the UI
			// NOTE: this property is only valid on user preferences 
			helpFlags1?: int
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
