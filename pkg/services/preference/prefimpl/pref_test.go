package prefimpl

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestPreferencesService(t *testing.T) {
	prefStoreFake := newPreferenceStoreFake()
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

	emptyQueryPreference := pref.QueryHistoryPreference{}

	queryPreference := pref.QueryHistoryPreference{
		HomeTab: "hometab",
	}

	queryPreference2 := pref.QueryHistoryPreference{
		HomeTab: "hometab",
	}

	emptyPreferencesJsonData := pref.PreferenceJSONData{
		Navbar: emptyNavbarPreferences,
	}
	userPreferencesJsonData := pref.PreferenceJSONData{
		Navbar:       userNavbarPreferences,
		QueryHistory: queryPreference,
	}
	orgPreferencesJsonData := pref.PreferenceJSONData{
		Navbar: orgNavbarPreferences,
	}
	team2PreferencesJsonData := pref.PreferenceJSONData{
		Navbar: team2NavbarPreferences,
	}
	team1PreferencesJsonData := pref.PreferenceJSONData{
		Navbar: team1NavbarPreferences,
	}

	t.Run("Get should return nothing", func(t *testing.T) {
		prefStoreFake.ExpectedGetError = pref.ErrPrefNotFound
		preference, err := prefService.Get(context.Background(), &pref.GetPreferenceQuery{})
		require.NoError(t, err)
		expected := &pref.Preference{}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
		prefStoreFake.ExpectedError = nil
	})

	t.Run("GetDefaults should return defaults", func(t *testing.T) {
		prefService.cfg = setting.NewCfg()
		prefService.cfg.DefaultTheme = "light"
		prefService.cfg.DateFormats.DefaultTimezone = "UTC"

		preference := prefService.GetDefaults()
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardID: 0,
			JSONData:        &pref.PreferenceJSONData{},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetDefaults with no saved preferences should return defaults", func(t *testing.T) {
		prefStoreFake.ExpectedError = nil
		prefStoreFake.ExpectedPreference = &pref.Preference{
			Theme:    "light",
			Timezone: "UTC",
		}
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardID: 0,
			JSONData:        &emptyPreferencesJsonData,
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
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
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "UTC",
			WeekStart:       "1",
			HomeDashboardID: 4,
			JSONData:        &pref.PreferenceJSONData{},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
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
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "2",
			HomeDashboardID: 4,
			JSONData:        &pref.PreferenceJSONData{},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("GetPreferencesWithDefaults with saved org and user json data should return user json data", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{}
		prefStoreFake.ExpectedListPreferences = []*pref.Preference{
			{
				OrgID:    1,
				JSONData: &orgPreferencesJsonData,
			},
			{
				OrgID:    1,
				UserID:   1,
				JSONData: &userPreferencesJsonData,
			},
		}
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, UserID: 1}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &pref.Preference{
			Theme:    "light",
			JSONData: &userPreferencesJsonData,
			Timezone: "UTC",
		}, preference)
	})

	t.Run("GetWithDefaults with saved org and teams json data should return last team json data", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{}
		prefStoreFake.ExpectedListPreferences = []*pref.Preference{
			{
				OrgID:    1,
				JSONData: &orgPreferencesJsonData,
			},
			{
				OrgID:    1,
				TeamID:   2,
				JSONData: &team1PreferencesJsonData,
			},
			{
				OrgID:    1,
				TeamID:   3,
				JSONData: &team2PreferencesJsonData,
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
			JSONData: &team2PreferencesJsonData,
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
			JSONData:        &pref.PreferenceJSONData{},
		}
		if diff := cmp.Diff(expected, preferences); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("SavePreferences for a user should store correct values", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{
			ID:              1,
			OrgID:           1,
			UserID:          3,
			TeamID:          6,
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

	t.Run("SavePreferences for a user should store correct values, when preference not found", func(t *testing.T) {
		prefStoreFake.ExpectedGetError = pref.ErrPrefNotFound
		prefStoreFake.ExpectedPreference = &pref.Preference{
			ID:              1,
			OrgID:           1,
			UserID:          3,
			TeamID:          6,
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
				WeekStart:       "1",
			},
		)
		require.NoError(t, err)
		prefStoreFake.ExpectedGetError = nil
	})

	t.Run("SavePreferences for a user should store correct values with nav and query history", func(t *testing.T) {
		prefStoreFake.ExpectedPreference = &pref.Preference{
			ID:              1,
			OrgID:           1,
			UserID:          3,
			TeamID:          6,
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			JSONData:        &userPreferencesJsonData,
		}
		err := prefService.Save(context.Background(),
			&pref.SavePreferenceCommand{
				Theme:           "dark",
				Timezone:        "browser",
				HomeDashboardID: 5,
				WeekStart:       "1",
				Navbar:          &userNavbarPreferences,
				QueryHistory:    &emptyQueryPreference,
			},
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

	t.Run("Patch for a user should store correct values", func(t *testing.T) {
		darkTheme := "dark"
		prefStoreFake.ExpectedPreference = &pref.Preference{
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			JSONData:        &userPreferencesJsonData,
		}
		err := prefService.Patch(context.Background(),
			&pref.PatchPreferenceCommand{
				Theme:        &darkTheme,
				Navbar:       &userNavbarPreferences,
				QueryHistory: &queryPreference2,
			})
		require.NoError(t, err)
	})

	t.Run("Patch for a user should store correct values, without navbar and query history", func(t *testing.T) {
		darkTheme := "dark"
		prefStoreFake.ExpectedPreference = &pref.Preference{
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
		}
		err := prefService.Patch(context.Background(),
			&pref.PatchPreferenceCommand{
				Theme:        &darkTheme,
				Navbar:       &userNavbarPreferences,
				QueryHistory: &queryPreference2,
			})
		require.NoError(t, err)
	})

	t.Run("Patch for a user should store correct values, when preference not found", func(t *testing.T) {
		timezone := "browser"
		weekStart := "1"
		homeDashboardID := int64(5)
		prefStoreFake.ExpectedGetError = pref.ErrPrefNotFound
		prefStoreFake.ExpectedPreference = nil

		err := prefService.Patch(context.Background(),
			&pref.PatchPreferenceCommand{
				HomeDashboardID: &homeDashboardID,
				Timezone:        &timezone,
				WeekStart:       &weekStart,
				Navbar:          &emptyNavbarPreferences,
				QueryHistory:    &emptyQueryPreference,
			})
		require.NoError(t, err)
		prefStoreFake.ExpectedGetError = nil
	})
}

type FakePreferenceStore struct {
	ExpectedPreference      *pref.Preference
	ExpectedListPreferences []*pref.Preference
	ExpectedID              int64
	ExpectedError           error
	ExpectedGetError        error
}

func newPreferenceStoreFake() *FakePreferenceStore {
	return &FakePreferenceStore{}
}

func (f *FakePreferenceStore) List(ctx context.Context, query *pref.Preference) ([]*pref.Preference, error) {
	return f.ExpectedListPreferences, f.ExpectedError
}

func (f *FakePreferenceStore) Get(ctx context.Context, query *pref.Preference) (*pref.Preference, error) {
	return f.ExpectedPreference, f.ExpectedGetError
}

func (f *FakePreferenceStore) Insert(ctx context.Context, cmd *pref.Preference) (int64, error) {
	return f.ExpectedID, f.ExpectedError
}

func (f *FakePreferenceStore) Update(ctx context.Context, cmd *pref.Preference) error {
	return f.ExpectedError
}
