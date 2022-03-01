package prefs

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/preferences/preftests"
)

func TestPreferencesDataAccess(t *testing.T) {
	prefStoreFakes := preftests.NewPreferenceStoreFake()
	prefManager := &ManagerImpl{
		preferenceStore: prefStoreFakes,
	}
	t.Run("GetPreferencesWithDefaults with no saved preferences should return defaults", func(t *testing.T) {
		prefStoreFakes.ExpectedPreferences = &models.Preferences{
			Theme:    "light",
			Timezone: "UTC",
		}
		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{}}
		preferences, err := prefManager.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &models.Preferences{
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardId: 0,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		prefStoreFakes.ExpectedPreferences = &models.Preferences{}
		prefStoreFakes.ExpectedListPreferences = []*models.Preferences{
			{
				OrgId:           1,
				HomeDashboardId: 1,
				Theme:           "dark",
				Timezone:        "UTC",
			},
			{
				OrgId:           1,
				UserId:          1,
				HomeDashboardId: 4,
				Theme:           "light",
				WeekStart:       "1",
			},
		}
		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 1}}
		preferences, err := prefManager.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &models.Preferences{
			Theme:           "light",
			Timezone:        "UTC",
			WeekStart:       "1",
			HomeDashboardId: 4,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
		prefStoreFakes.ExpectedPreferences = &models.Preferences{}
		prefStoreFakes.ExpectedListPreferences = []*models.Preferences{
			{
				OrgId:           1,
				HomeDashboardId: 1,
				Theme:           "dark",
				Timezone:        "UTC",
				WeekStart:       "1",
			},
			{
				OrgId:           1,
				UserId:          1,
				HomeDashboardId: 4,
				Theme:           "light",
				Timezone:        "browser",
				WeekStart:       "2",
			},
		}
		prefManager.preferenceStore.GetDefaults().HomeDashboardId = 1
		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 2}}
		preferences, err := prefManager.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &models.Preferences{
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "2",
			HomeDashboardId: 4,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
		prefStoreFakes.ExpectedPreferences = &models.Preferences{
			Theme:    "dark",
			Timezone: "UTC",
		}
		prefStoreFakes.ExpectedListPreferences = []*models.Preferences{
			{
				OrgId:           1,
				HomeDashboardId: 1,
				Theme:           "light",
				Timezone:        "browser",
				WeekStart:       "1",
			},
			{
				OrgId:           1,
				UserId:          1,
				HomeDashboardId: 4,
				Theme:           "light",
				Timezone:        "browser",
				WeekStart:       "2",
			},
		}

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, Teams: []int64{2, 3}},
		}
		preferences, err := prefManager.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &models.Preferences{
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "2",
			HomeDashboardId: 4,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("SavePreferences for a user should store correct values", func(t *testing.T) {
		prefStoreFakes.ExpectedPreferences = &models.Preferences{
			HomeDashboardId: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
		}
		preferences, err := prefManager.SavePreferences(context.Background(), &models.SavePreferencesCommand{UserId: models.SignedInUser{}.UserId, Theme: "dark", Timezone: "browser", HomeDashboardId: 5, WeekStart: "1"})
		require.NoError(t, err)

		expected := &models.Preferences{
			Id:              preferences.Id,
			Version:         preferences.Version,
			HomeDashboardId: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			Created:         preferences.Created,
			Updated:         preferences.Updated,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferences for a user should store correct values", func(t *testing.T) {
		prefStoreFakes.ExpectedPreferences = &models.Preferences{
			HomeDashboardId: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
		}
		preferences, err := prefManager.GetPreferences(context.Background(), &models.GetPreferencesQuery{UserId: models.SignedInUser{}.UserId})
		require.NoError(t, err)

		expected := &models.Preferences{
			Id:              preferences.Id,
			Version:         preferences.Version,
			HomeDashboardId: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			Created:         preferences.Created,
			Updated:         preferences.Updated,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}
