package preferences

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

func TestStarsQueries(t *testing.T) {
	tests := []struct {
		name     string
		defaults preferences.PreferencesSpec
		items    []preferences.Preferences
		expect   preferences.PreferencesSpec
	}{
		{
			name: "test1",
			defaults: preferences.PreferencesSpec{
				Theme:            ptr.To("settings.ini"),
				Language:         ptr.To("settings.ini"),
				HomeDashboardUID: ptr.To("settings.ini"),
				Timezone:         ptr.To("settings.ini"),
			},
			items: []preferences.Preferences{
				{Spec: preferences.PreferencesSpec{
					Theme:            ptr.To("namespace"),
					Language:         ptr.To("namespace"),
					HomeDashboardUID: ptr.To("namespace"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme:    ptr.To("team"),
					Language: ptr.To("team"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme: ptr.To("user"),
				}},
			},
			expect: preferences.PreferencesSpec{
				Theme:            ptr.To("user"),
				Language:         ptr.To("team"),
				HomeDashboardUID: ptr.To("namespace"),
				Timezone:         ptr.To("settings.ini"),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			current, err := merge(tt.defaults, tt.items)
			require.NoError(t, err)
			require.Equal(t, tt.expect, current.Spec)
		})
	}
}
