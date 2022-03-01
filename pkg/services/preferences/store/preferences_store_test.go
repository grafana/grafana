package prefsstore

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestPreferencesDataAccess(t *testing.T) {
	// prefStoreFakes := preftests.NewPreferenceStoreFake()
	prefStore := &StoreImpl{
		sqlStore: sqlstore.InitTestDB(t),
	}
	t.Run("GetPreferencesWithDefaults with no saved preferences should return defaults", func(t *testing.T) {
		// prefStoreFakes.ExpectedPreferences = &models.Preferences{
		// 	Theme:    "light",
		// 	Timezone: "UTC",
		// }
		query := &models.ListPreferencesQuery{}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, "light", preferences[0].Theme)
		require.Equal(t, "UTC", preferences[0].Timezone)
		require.Equal(t, int64(0), preferences[0].HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.ListPreferencesQuery{OrgID: 1, UserID: 1}
		// prefManager.preferenceStore.GetDefaults().HomeDashboardId = 4
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), preferences[0].HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)
		// prefManager.preferenceStore.GetDefaults().HomeDashboardId = 1
		query := &models.ListPreferencesQuery{OrgID: 1, UserID: 2}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), preferences[0].HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)

		// prefStore.preferenceStore.GetDefaults().HomeDashboardId = 3
		query := &models.ListPreferencesQuery{
			// User: &models.SignedInUser{
			OrgID: 1, Teams: []int64{2, 3},
			// },
		}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(3), preferences[0].HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and other teams home dashboard should return org home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)
		// prefStore.preferenceStore.GetDefaults().HomeDashboardId = 1
		query := &models.ListPreferencesQuery{OrgID: 1}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), preferences[0].HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org, teams and user home dashboard should return user home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)
		// prefManager.preferenceStore.GetDefaults().HomeDashboardId = 4
		query := &models.ListPreferencesQuery{
			// User: &models.SignedInUser{
			OrgID: 1, UserID: 1, Teams: []int64{2, 3},
			// },
		}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), preferences[0].HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org, other teams and user home dashboard should return org home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)
		// prefManager.preferenceStore.GetDefaults().HomeDashboardId = 1
		query := &models.ListPreferencesQuery{
			// User: &models.SignedInUser{
			OrgID: 1, UserID: 2,
			// },
		}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), preferences[0].HomeDashboardId)
	})

	t.Run("SavePreferences for a user should store correct values", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{UserId: models.SignedInUser{}.UserId, Theme: "dark", Timezone: "browser", HomeDashboardId: 5, WeekStart: "1"})
		require.NoError(t, err)
		// expctedPrefs := &models.Preferences{
		// 	// Id:              preferences.Id,
		// 	// Version:         preferences.Version,
		// 	HomeDashboardId: 5,
		// 	Timezone:        "browser",
		// 	WeekStart:       "1",
		// 	Theme:           "dark",
		// 	// Created:         preferences.Created,
		// 	// Updated:         preferences.Updated,
		// }
		// prefStoreFakes.ExpectedPreferences = expctedPrefs
		query := &models.ListPreferencesQuery{} //User: &models.SignedInUser{}}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		expected := &models.Preferences{
			Id:              preferences[0].Id,
			Version:         preferences[0].Version,
			HomeDashboardId: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			Created:         preferences[0].Created,
			Updated:         preferences[0].Updated,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}
