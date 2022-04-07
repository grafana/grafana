package prefimpl

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestPreferencesService(t *testing.T) {
	prefStoreFake := preftest.NewPreferenceStoreFake()
	prefService := &Service{
		store: prefStoreFake,
	}

	emptyNavbarPreferences := pref.NavbarPreference{}
	userNavbarPreferences := pref.NavbarPreference{
		SavedItems: []pref.NavLink{{
			ID:   "explore",
			Text: "Explore",
			Url:  "/explore",
		}},
	}
	orgNavbarPreferences := pref.NavbarPreference{
		SavedItems: []pref.NavLink{{
			ID:   "alerting",
			Text: "Alerting",
			Url:  "/alerting",
		}},
	}
	team1NavbarPreferences := pref.NavbarPreference{
		SavedItems: []pref.NavLink{{
			ID:   "dashboards",
			Text: "Dashboards",
			Url:  "/dashboards",
		}},
	}
	team2NavbarPreferences := pref.NavbarPreference{
		SavedItems: []pref.NavLink{{
			ID:   "home",
			Text: "Home",
			Url:  "/home",
		}},
	}

	emptyPreferencesJsonData := pref.PreferencesJsonData{
		Navbar: emptyNavbarPreferences,
	}
	userPreferencesJsonData := pref.PreferencesJsonData{
		Navbar: userNavbarPreferences,
	}
	orgPreferencesJsonData := pref.PreferencesJsonData{
		Navbar: orgNavbarPreferences,
	}
	team2PreferencesJsonData := pref.PreferencesJsonData{
		Navbar: team2NavbarPreferences,
	}
	team1PreferencesJsonData := pref.PreferencesJsonData{
		Navbar: team1NavbarPreferences,
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
			JsonData:        &pref.PreferencesJsonData{},
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetDefaults with no saved preferences should return defaults", func(t *testing.T) {
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
			JsonData:        &emptyPreferencesJsonData,
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetWithDefaults with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
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
			JsonData:        &pref.PreferencesJsonData{},
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetWithDefaults with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
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
			JsonData:        &pref.PreferencesJsonData{},
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with saved org and user json data should return user json data", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{}
		prefStoreFake.ExpectedListPreferences = []*pref.Preference{
			{
				OrgID:    1,
				JsonData: &orgPreferencesJsonData,
			},
			{
				OrgID:    1,
				UserID:   1,
				JsonData: &userPreferencesJsonData,
			},
		}
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, UserID: 1}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &pref.Preference{
			Theme:    "light",
			JsonData: &userPreferencesJsonData,
			Timezone: "UTC",
		}, preference)
	})
	// t.Run("GetPreferencesWithDefaults with saved org, other teams and user home dashboard should return org home dashboard", func(t *testing.T) {
	// 	prefStoreFake.ExpectedPreference = &pref.Preference{}
	// 	prefStoreFake.ExpectedListPreferences = []*pref.Preference{
	// 		{
	// 			OrgId:           1,
	// 			HomeDashboardId: 1,
	// 		},
	// 		{
	// 			OrgId:           1,
	// 			TeamId:          2,
	// 			HomeDashboardId: 2,
	// 		},
	// 		{
	// 			OrgId:           1,
	// 			TeamId:          3,
	// 			HomeDashboardId: 3,
	// 		},
	// 		{
	// 			OrgId:           1,
	// 			UserId:          1,
	// 			HomeDashboardId: 4,
	// 		},
	// 	}

	// 	query := &pref.GetPreferenceWithDefaultsQuery{
	// 		OrgID: 1, UserID: 2,
	// 	}
	// 	preference, err := prefService.GetWithDefaults(context.Background(), query)
	// 	require.NoError(t, err)
	// 	require.Equal(t, int64(1), preference.HomeDashboardId)
	// })
	t.Run("GetWithDefaults with saved org and teams json data should return last team json data", func(t *testing.T) {

		prefStoreFake.ExpectedPreference = &pref.Preference{}
		prefStoreFake.ExpectedListPreferences = []*pref.Preference{
			{
				OrgID:    1,
				JsonData: &orgPreferencesJsonData,
			},
			{
				OrgID:    1,
				TeamID:   2,
				JsonData: &team1PreferencesJsonData,
			},
			{
				OrgID:    1,
				TeamID:   3,
				JsonData: &team2PreferencesJsonData,
			},
		}
		query := &pref.GetPreferenceWithDefaultsQuery{
			OrgID: 1, Teams: []int64{2, 3},
		}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &pref.Preference{
			Timezone: "UTC",
			Theme:    "light",
			JsonData: &team2PreferencesJsonData,
		}, preference)
	})

	t.Run("GetWithDefaults with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
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
			JsonData:        &pref.PreferencesJsonData{},
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

	t.Run("Get for a user should store correct values", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
		}
		preference, err := prefService.Get(context.Background(), &pref.GetPreferenceQuery{})
		require.NoError(t, err)

		expected := &pref.Preference{
			Id:              preference.Id,
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

	t.Run("Patch for a user should store correct values", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
		}
		err := prefService.Patch(context.Background(), &pref.PatchPreferenceCommand{})
		require.NoError(t, err)
	})
}
