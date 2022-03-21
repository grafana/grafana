package prefimpl

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestPreferencesDataAccess(t *testing.T) {
	prefStore := &StoreImpl{
		sqlStore: sqlstore.InitTestDB(t),
	}
	t.Run("GetDefaults should return defaults", func(t *testing.T) {
		prefStore.cfg = setting.NewCfg()
		prefStore.cfg.DefaultTheme = "light"
		prefStore.cfg.DateFormats.DefaultTimezone = "UTC"

		preferences := prefStore.GetDefaults()
		expected := &models.Preferences{
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardId: 0,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("List with saved org and user home dashboard should return user home dashboards", func(t *testing.T) {
		_, err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		_, err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.ListPreferencesQuery{OrgID: 1, UserID: 1}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), preferences[0].HomeDashboardId)
		require.Equal(t, int64(4), preferences[1].HomeDashboardId)
	})

	t.Run("List with saved org and teams home dashboard should return last team home dashboards", func(t *testing.T) {
		_, err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		_, err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		_, err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)

		query := &models.ListPreferencesQuery{
			OrgID: 1,
			Teams: []int64{2, 3},
		}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), preferences[0].HomeDashboardId)
		require.Equal(t, int64(2), preferences[1].HomeDashboardId)
		require.Equal(t, int64(3), preferences[2].HomeDashboardId)
	})

	t.Run("List with saved org, teams and user home dashboard should return user home dashboards", func(t *testing.T) {
		_, err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		_, err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		_, err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)
		_, err = prefStore.Set(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.ListPreferencesQuery{
			OrgID:  1,
			UserID: 1,
			Teams:  []int64{2, 3},
		}
		preferences, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), preferences[0].HomeDashboardId)
		require.Equal(t, int64(2), preferences[1].HomeDashboardId)
		require.Equal(t, int64(3), preferences[2].HomeDashboardId)
		require.Equal(t, int64(4), preferences[3].HomeDashboardId)
	})

	t.Run("Set preferences for a user should store correct values", func(t *testing.T) {
		_, err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{UserId: models.SignedInUser{}.UserId, Theme: "dark", Timezone: "browser", HomeDashboardId: 5, WeekStart: "1"})
		require.NoError(t, err)

		query := &models.ListPreferencesQuery{}
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
		if diff := cmp.Diff(expected, preferences[0]); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Get preferences for a user should store correct values", func(t *testing.T) {
		_, err := prefStore.Set(context.Background(), &models.SavePreferencesCommand{UserId: models.SignedInUser{}.UserId, Theme: "dark", Timezone: "browser", HomeDashboardId: 5, WeekStart: "1"})
		require.NoError(t, err)
		preferences, err := prefStore.Get(context.Background(), &models.GetPreferencesQuery{UserId: models.SignedInUser{}.UserId})
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
