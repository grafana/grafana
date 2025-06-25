package folder

preferences: {
	kind:       "Preferences"
	pluralName: "Preferences"
	current:    "v1alpha0"
	codegen: {
		ts: {
			enabled: false // Not sure if it should be enabled or not, currently it is.
		}
		go: {
			enabled: true
		}
	}

	versions: {
		"v0alpha1": {
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

					// Selected locale (beta)
					locale?: string

					// Explore query history preferences
					queryHistory?: #QueryHistoryPreference

					// Cookie preferences
					cookiePreferences?: #CookiePreferences

					// Navigation preferences
					navbar?: #NavbarPreference
				} @cuetsy(kind="interface")

				#QueryHistoryPreference: {
					// one of: '' | 'query' | 'starred';
					homeTab?: string
				} @cuetsy(kind="interface")

				#CookiePreferences: {
					analytics?: {}
					performance?: {}
					functional?: {}
				} @cuetsy(kind="interface")

				#NavbarPreference: {
					bookmarkUrls: [...string]
				} @cuetsy(kind="interface")
			}
		}
	}
}
