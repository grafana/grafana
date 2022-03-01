//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestPreferencesDataAccess(t *testing.T) {
	ss := InitTestDB(t)
	emptyNavbarPreferences := []models.NavbarPreference(nil)
	userNavbarPreferences := []models.NavbarPreference{{
		Id:             "explore",
		HideFromNavbar: true,
	}}
	orgNavbarPreferences := []models.NavbarPreference{{
		Id:             "alerting",
		HideFromNavbar: true,
	}}
	team1NavbarPreferences := []models.NavbarPreference{{
		Id:             "dashboards",
		HideFromNavbar: true,
	}}
	team2NavbarPreferences := []models.NavbarPreference{{
		Id:             "home",
		HideFromNavbar: true,
	}}

	emptyPreferencesJsonData := models.PreferencesJsonData{
		Navbar: emptyNavbarPreferences,
	}
	userPreferencesJsonData := models.PreferencesJsonData{
		Navbar: userNavbarPreferences,
	}
	orgPreferencesJsonData := models.PreferencesJsonData{
		Navbar: orgNavbarPreferences,
	}
	team1PreferencesJsonData := models.PreferencesJsonData{
		Navbar: team1NavbarPreferences,
	}
	team2PreferencesJsonData := models.PreferencesJsonData{
		Navbar: team2NavbarPreferences,
	}

	t.Run("GetPreferencesWithDefaults with no saved preferences should return defaults", func(t *testing.T) {
		ss.Cfg.DefaultTheme = "light"
		ss.Cfg.DateFormats.DefaultTimezone = "UTC"

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{}}
		err := ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, "light", query.Result.Theme)
		require.Equal(t, "UTC", query.Result.Timezone)
		require.Equal(t, int64(0), query.Result.HomeDashboardId)
		require.Equal(t, &emptyPreferencesJsonData, query.Result.JsonData)
	})

	t.Run("GetPreferencesWithDefaults with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 1}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 2}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, Teams: []int64{2, 3}},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(3), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and other teams home dashboard should return org home dashboard", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org, teams and user home dashboard should return user home dashboard", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, UserId: 1, Teams: []int64{2, 3}},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org, other teams and user home dashboard should return org home dashboard", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, HomeDashboardId: 3})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, UserId: 2},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), query.Result.HomeDashboardId)
	})

	t.Run("GetPreferencesWithDefaults with saved org and user json data should return user json data", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, JsonData: &orgPreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, JsonData: &userPreferencesJsonData})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 1}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &userPreferencesJsonData, query.Result.JsonData)
	})

	t.Run("GetPreferencesWithDefaults with saved org and other user json data should return org json data", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, JsonData: &orgPreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, JsonData: &userPreferencesJsonData})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1, UserId: 2}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &orgPreferencesJsonData, query.Result.JsonData)
	})

	t.Run("GetPreferencesWithDefaults with saved org and teams json data should return last team json data", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, JsonData: &orgPreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, JsonData: &team1PreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, JsonData: &team2PreferencesJsonData})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, Teams: []int64{2, 3}},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &team2PreferencesJsonData, query.Result.JsonData)
	})

	t.Run("GetPreferencesWithDefaults with saved org and other teams json data should return org json data", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, JsonData: &orgPreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, JsonData: &team1PreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, JsonData: &team2PreferencesJsonData})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{OrgId: 1}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &orgPreferencesJsonData, query.Result.JsonData)
	})

	t.Run("GetPreferencesWithDefaults with saved org, teams and user json data should return user json data", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, JsonData: &orgPreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, JsonData: &team1PreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, JsonData: &team2PreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, JsonData: &userPreferencesJsonData})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, UserId: 1, Teams: []int64{2, 3}},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &userPreferencesJsonData, query.Result.JsonData)
	})

	t.Run("GetPreferencesWithDefaults with saved org, other teams and user json data should return org json data", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, JsonData: &orgPreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 2, JsonData: &team1PreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, TeamId: 3, JsonData: &team2PreferencesJsonData})
		require.NoError(t, err)
		err = ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{OrgId: 1, UserId: 1, JsonData: &userPreferencesJsonData})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{
			User: &models.SignedInUser{OrgId: 1, UserId: 2},
		}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &orgPreferencesJsonData, query.Result.JsonData)
	})

	t.Run("SavePreferences for a user should store correct values", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{UserId: models.SignedInUser{}.UserId, Theme: "dark", Timezone: "browser", HomeDashboardId: 5, WeekStart: "1", JsonData: &userPreferencesJsonData})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &models.Preferences{
			Id:              query.Result.Id,
			Version:         query.Result.Version,
			HomeDashboardId: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			JsonData:        &userPreferencesJsonData,
			Created:         query.Result.Created,
			Updated:         query.Result.Updated,
		}
		if diff := cmp.Diff(expected, query.Result); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("UpsertPreferences for a user should only modify a single value", func(t *testing.T) {
		err := ss.SavePreferences(context.Background(), &models.SavePreferencesCommand{UserId: models.SignedInUser{}.UserId, Theme: "dark", Timezone: "browser", HomeDashboardId: 5, WeekStart: "1", JsonData: &orgPreferencesJsonData})
		require.NoError(t, err)

		err = ss.UpsertPreferences(context.Background(), &models.SavePreferencesCommand{UserId: models.SignedInUser{}.UserId, JsonData: &userPreferencesJsonData})
		require.NoError(t, err)

		query := &models.GetPreferencesWithDefaultsQuery{User: &models.SignedInUser{}}
		err = ss.GetPreferencesWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &models.Preferences{
			Id:              query.Result.Id,
			Version:         query.Result.Version,
			HomeDashboardId: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			JsonData:        &userPreferencesJsonData,
			Created:         query.Result.Created,
			Updated:         query.Result.Updated,
		}
		if diff := cmp.Diff(expected, query.Result); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}
