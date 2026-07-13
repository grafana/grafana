// Package v1alpha1 re-exports the Preferences resource types from v1 while
// registering preferences.grafana.app/v1alpha1 on the app-sdk resource.Kind (see
// PreferencesKind). v1 is the stable, canonical version; v1alpha1 is kept as a
// served compatibility alias.
package v1alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
)

type (
	Preferences                       = v1.Preferences
	PreferencesList                   = v1.PreferencesList
	PreferencesSpec                   = v1.PreferencesSpec
	PreferencesNavbarPreference       = v1.PreferencesNavbarPreference
	PreferencesQueryHistoryPreference = v1.PreferencesQueryHistoryPreference
	PreferencesJSONCodec              = v1.PreferencesJSONCodec
)

var (
	NewPreferences                       = v1.NewPreferences
	NewPreferencesSpec                   = v1.NewPreferencesSpec
	NewPreferencesNavbarPreference       = v1.NewPreferencesNavbarPreference
	NewPreferencesQueryHistoryPreference = v1.NewPreferencesQueryHistoryPreference
)

var (
	schemaPreferences = resource.NewSimpleSchema(APIGroup, APIVersion, NewPreferences(), &PreferencesList{},
		resource.WithKind("Preferences"),
		resource.WithPlural("preferences"),
		resource.WithScope(resource.NamespacedScope))
	kindPreferences = resource.Kind{
		Schema: schemaPreferences,
		Codecs: map[resource.KindEncoding]resource.Codec{
			resource.KindEncodingJSON: &PreferencesJSONCodec{},
		},
	}
)

// PreferencesKind returns a resource.Kind for the v1alpha1 Preferences schema with a JSON codec
func PreferencesKind() resource.Kind {
	return kindPreferences
}

// PreferencesSchema returns a resource.SimpleSchema representation of v1alpha1 Preferences
func PreferencesSchema() *resource.SimpleSchema {
	return schemaPreferences
}

var _ resource.Schema = kindPreferences
