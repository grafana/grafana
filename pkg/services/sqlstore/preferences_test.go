// +build integration

package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestPreferencesDataAccess(t *testing.T) {
	ss := InitTestDB(t)

	t.Run("GetPreferencesWithDefaults with no saved preferences should return defaults", func(t *testing.T) {
		ss.Cfg.DefaultTheme = "light"
		ss.Cfg.DateFormats.DefaultTimezone = "UTC"

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{}}
		err := ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, "light", query.Result.Theme)
		require.Equal(t, "UTC", query.Result.Timezone)
		require.Equal(t, int64(0), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 1}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
		err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 2}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
		err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, Teams: []int64{2, 3}},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(3), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and other teams home dashboard should return org home dashboard", func(t *testing.T) {
		err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org, teams and user home dashboard should return user home dashboard", func(t *testing.T) {
		err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, UserId: 1, Teams: []int64{2, 3}},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org, other teams and user home dashboard should return org home dashboard", func(t *testing.T) {
		err := SavePreferences(&models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)
		err = SavePreferences(&models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, UserId: 2},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), query.Result.HomeDashboardId)
	})
}
