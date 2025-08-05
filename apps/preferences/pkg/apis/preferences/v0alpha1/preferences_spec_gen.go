// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PreferencesQueryHistoryPreference struct {
	// one of: '' | 'query' | 'starred';
	HomeTab *string `json:"homeTab,omitempty"`
}

// NewPreferencesQueryHistoryPreference creates a new PreferencesQueryHistoryPreference object.
func NewPreferencesQueryHistoryPreference() *PreferencesQueryHistoryPreference {
	return &PreferencesQueryHistoryPreference{}
}

// +k8s:openapi-gen=true
type PreferencesCookiePreferences struct {
	Analytics   interface{} `json:"analytics,omitempty"`
	Performance interface{} `json:"performance,omitempty"`
	Functional  interface{} `json:"functional,omitempty"`
}

// NewPreferencesCookiePreferences creates a new PreferencesCookiePreferences object.
func NewPreferencesCookiePreferences() *PreferencesCookiePreferences {
	return &PreferencesCookiePreferences{}
}

// +k8s:openapi-gen=true
type PreferencesNavbarPreference struct {
	BookmarkUrls []string `json:"bookmarkUrls"`
}

// NewPreferencesNavbarPreference creates a new PreferencesNavbarPreference object.
func NewPreferencesNavbarPreference() *PreferencesNavbarPreference {
	return &PreferencesNavbarPreference{
		BookmarkUrls: []string{},
	}
}

// +k8s:openapi-gen=true
type PreferencesSpec struct {
	// UID for the home dashboard
	HomeDashboardUID *string `json:"homeDashboardUID,omitempty"`
	// The timezone selection
	// TODO: this should use the timezone defined in common
	Timezone *string `json:"timezone,omitempty"`
	// day of the week (sunday, monday, etc)
	WeekStart *string `json:"weekStart,omitempty"`
	// light, dark, empty is default
	Theme *string `json:"theme,omitempty"`
	// Selected language (beta)
	Language *string `json:"language,omitempty"`
	// Selected locale (beta)
	RegionalFormat *string `json:"regionalFormat,omitempty"`
	// Explore query history preferences
	QueryHistory *PreferencesQueryHistoryPreference `json:"queryHistory,omitempty"`
	// Cookie preferences
	CookiePreferences *PreferencesCookiePreferences `json:"cookiePreferences,omitempty"`
	// Navigation preferences
	Navbar *PreferencesNavbarPreference `json:"navbar,omitempty"`
}

// NewPreferencesSpec creates a new PreferencesSpec object.
func NewPreferencesSpec() *PreferencesSpec {
	return &PreferencesSpec{}
}
