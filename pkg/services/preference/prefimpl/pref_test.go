package prefimpl

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPreferencesService(t *testing.T) {
	prefStoreFake := preftest.NewPreferenceStoreFake()
	prefService := &Service{
		store: prefStoreFake,
	}
	t.Run("GetDefaults should return defaults", func(t *testing.T) {
		prefService.cfg = setting.NewCfg()
		prefService.cfg.DefaultTheme = "light"
		prefService.cfg.DateFormats.DefaultTimezone = "UTC"

		preferences := prefService.GetDefaults()
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardID: 0,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with no saved preferences should return defaults", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{
			Theme:    "light",
			Timezone: "UTC",
		}
		query := &pref.GetPreferenceWithDefaultsQuery{}
		preferences, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardID: 0,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{}
		prefStoreFake.ExpectedListPreferences = []*pref.Preference{
			{
				OrgID:           1,
				HomeDashboardID: 1,
				Theme:           "dark",
				Timezone:        "UTC",
			},
			{
				OrgID:           1,
				UserID:          1,
				HomeDashboardID: 4,
				Theme:           "light",
				WeekStart:       "1",
			},
		}
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, UserID: 1}
		preferences, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "UTC",
			WeekStart:       "1",
			HomeDashboardID: 4,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{}
		prefStoreFake.ExpectedListPreferences = []*pref.Preference{
			{
				OrgID:           1,
				HomeDashboardID: 1,
				Theme:           "dark",
				Timezone:        "UTC",
				WeekStart:       "1",
			},
			{
				OrgID:           1,
				UserID:          1,
				HomeDashboardID: 4,
				Theme:           "light",
				Timezone:        "browser",
				WeekStart:       "2",
			},
		}
		prefService.GetDefaults().HomeDashboardID = 1
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, UserID: 2}
		preferences, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "2",
			HomeDashboardID: 4,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{
			Theme:    "dark",
			Timezone: "UTC",
		}
		prefStoreFake.ExpectedListPreferences = []*pref.Preference{
			{
				OrgID:           1,
				HomeDashboardID: 1,
				Theme:           "light",
				Timezone:        "browser",
				WeekStart:       "1",
			},
			{
				OrgID:           1,
				UserID:          1,
				HomeDashboardID: 4,
				Theme:           "light",
				Timezone:        "browser",
				WeekStart:       "2",
			},
		}

		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, Teams: []int64{2, 3}}
		preferences, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "2",
			HomeDashboardID: 4,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("SavePreferences for a user should store correct values", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
		}
		err := prefService.Save(context.Background(),
			&pref.SavePreferenceCommand{
				Theme:           "dark",
				Timezone:        "browser",
				HomeDashboardID: 5,
				WeekStart:       "1"},
		)
		require.NoError(t, err)
	})

	t.Run("GetPreferences for a user should store correct values", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
		}
		preference, err := prefService.Get(context.Background(), &pref.GetPreferenceQuery{})
		require.NoError(t, err)

		expected := &pref.Preference{
			ID:              preference.ID,
			Version:         preference.Version,
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			Created:         preference.Created,
			Updated:         preference.Updated,
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}
