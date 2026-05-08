package preferences

import (
	"testing"

	"github.com/stretchr/testify/require"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

func TestMergePreferences(t *testing.T) {
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
				WeekStart:        new("settings.ini"),
			},
			items: []preferences.Preferences{
				{Spec: preferences.PreferencesSpec{
					Theme: new("user"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme:    new("teamA"),
					Language: new("teamA"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme:            new("teamB"),
					Language:         new("teamB"),
					HomeDashboardUID: new("teamB"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme:            new("namespace"),
					Language:         new("namespace"),
					HomeDashboardUID: new("namespace"),
					Timezone:         new("namespace"),
				}},
			},
			expect: preferences.PreferencesSpec{
				Theme:            new("user"),
				Language:         new("teamA"),
				HomeDashboardUID: new("teamB"),
				Timezone:         new("namespace"),
				WeekStart:        new("settings.ini"),
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
