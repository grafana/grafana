package preferences

#QueryHistoryPreference: {
	// one of: '' | 'query' | 'starred';
	homeTab?: string
}

#NavbarPreference: {
	bookmarkUrls: [...string]
}

#Spec: {
	// Explicit home URL (NOTE: this can only be modified in the system settings)
	homeURL?: string

	// UID for the home dashboard. The reserved value "global-home" is not a
	// dashboard UID: it selects the instance default home (home_page, the
	// configured home dashboard file, or the built-in home page) instead of
	// falling through to lower-precedence preferences.
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

preferencesV1alpha1: {
	kind:       "Preferences"
	pluralName: "Preferences"
	scope:      "Namespaced"

	// Generic read routes cannot apply the owner filtering used by normal list reads.
	listKeys: false
	search: {
		endpoint: false
	}

	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	schema: {
		spec: #Spec
	}
}

preferencesV1: {
	kind:       "Preferences"
	pluralName: "Preferences"
	scope:      "Namespaced"

	// Generic read routes cannot apply the owner filtering used by normal list reads.
	listKeys: false
	search: {
		endpoint: false
	}

	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	schema: {
		spec: #Spec
	}
}
