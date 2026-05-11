package preferences

import (
	"testing"

	"github.com/stretchr/testify/require"

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
				Theme:            new("settings.ini"),
				Language:         new("settings.ini"),
				HomeDashboardUID: new("settings.ini"),
				Timezone:         new("settings.ini"),
			},
			items: []preferences.Preferences{
				{Spec: preferences.PreferencesSpec{
					Theme:            new("namespace"),
					Language:         new("namespace"),
					HomeDashboardUID: new("namespace"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme:    new("team"),
					Language: new("team"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme: new("user"),
				}},
			},
			expect: preferences.PreferencesSpec{
				Theme:            new("user"),
				Language:         new("team"),
				HomeDashboardUID: new("namespace"),
				Timezone:         new("settings.ini"),
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
