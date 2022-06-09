package prefimpl

import (
	"context"
	"fmt"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGet_empty(t *testing.T) {
	prefService := &Service{
		store: newFake(),
		cfg:   setting.NewCfg(),
	}
	preference, err := prefService.Get(context.Background(), &pref.GetPreferenceQuery{})
	require.NoError(t, err)
	expected := &pref.Preference{}
	if diff := cmp.Diff(expected, preference); diff != "" {
		t.Fatalf("Result mismatch (-want +got):\n%s", diff)
	}
}

func TestGetDefaults(t *testing.T) {
	prefService := &Service{
		store: newFake(),
		cfg:   setting.NewCfg(),
	}
	prefService.cfg.DefaultTheme = "light"
	prefService.cfg.DateFormats.DefaultTimezone = "UTC"

	t.Run("GetDefaults", func(t *testing.T) {
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

	t.Run("GetWithDefaults", func(t *testing.T) {
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardID: 0,
			JSONData: &pref.PreferenceJSONData{
				Navbar: pref.NavbarPreference{},
			},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestGetWithDefaults_withUserAndOrgPrefs(t *testing.T) {
	prefService := &Service{
		store: newFake(),
		cfg:   setting.NewCfg(),
	}
	insertPrefs(t, prefService.store,
		pref.Preference{
			OrgID:           1,
			HomeDashboardID: 1,
			Theme:           "dark",
			Timezone:        "UTC",
			WeekStart:       "1",
		},
		pref.Preference{
			OrgID:           1,
			UserID:          1,
			HomeDashboardID: 4,
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "2",
		},
	)

	t.Run("prefer user's preferences", func(t *testing.T) {
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, UserID: 1}
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

	t.Run("ignore other user's preferences", func(t *testing.T) {
		prefService.GetDefaults().HomeDashboardID = 1
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, UserID: 2}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "dark",
			Timezone:        "UTC",
			WeekStart:       "1",
			HomeDashboardID: 1,
			JSONData:        &pref.PreferenceJSONData{},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestGetDefaults_JSONData(t *testing.T) {
	queryPreference := pref.QueryHistoryPreference{
		HomeTab: "hometab",
	}
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

	t.Run("users have precedence over org", func(t *testing.T) {
		prefService := &Service{
			store: newFake(),
			cfg:   setting.NewCfg(),
		}

		insertPrefs(t, prefService.store,
			pref.Preference{
				OrgID:    1,
				JSONData: &orgPreferencesJsonData,
			},
			pref.Preference{
				OrgID:    1,
				UserID:   1,
				JSONData: &userPreferencesJsonData,
			},
		)

		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, UserID: 1}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &pref.Preference{
			JSONData: &userPreferencesJsonData,
		}, preference)
	})

	t.Run("teams have precedence over org and are read in ascending order", func(t *testing.T) {
		prefService := &Service{
			store: newFake(),
			cfg:   setting.NewCfg(),
		}

		insertPrefs(t, prefService.store,
			pref.Preference{
				OrgID:    1,
				JSONData: &orgPreferencesJsonData,
			},
			pref.Preference{
				OrgID:    1,
				TeamID:   2,
				JSONData: &team1PreferencesJsonData,
			},
			pref.Preference{
				OrgID:    1,
				TeamID:   3,
				JSONData: &team2PreferencesJsonData,
			},
		)

		query := &pref.GetPreferenceWithDefaultsQuery{
			OrgID: 1, Teams: []int64{2, 3},
		}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, &pref.Preference{
			JSONData: &team2PreferencesJsonData,
		}, preference)
	})
}

func TestGetWithDefaults_teams(t *testing.T) {
	prefService := &Service{
		store: newFake(),
		cfg:   setting.NewCfg(),
	}
	insertPrefs(t, prefService.store,
		pref.Preference{
			OrgID:           1,
			HomeDashboardID: 1,
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "1",
		},
		pref.Preference{
			OrgID:           1,
			TeamID:          2,
			HomeDashboardID: 3,
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "2",
		},
		pref.Preference{
			OrgID:           1,
			TeamID:          3,
			HomeDashboardID: 4,
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       "2",
		},
	)

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
}

func TestPreferencesService(t *testing.T) {
	prefStoreFake := newFake()
	prefService := &Service{
		store: prefStoreFake,
		cfg:   setting.NewCfg(),
	}

	emptyNavbarPreferences := pref.NavbarPreference{}
	userNavbarPreferences := pref.NavbarPreference{
		SavedItems: []pref.NavLink{{
			ID:   "explore",
			Text: "Explore",
			Url:  "/explore",
		}},
	}

	emptyQueryPreference := pref.QueryHistoryPreference{}

	queryPreference2 := pref.QueryHistoryPreference{
		HomeTab: "hometab",
	}

	t.Run("SavePreferences for a user should store correct values", func(t *testing.T) {
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
		err := prefService.Save(context.Background(),
			&pref.SavePreferenceCommand{
				Theme:           "dark",
				Timezone:        "browser",
				HomeDashboardID: 5,
				WeekStart:       "1",
			},
		)
		require.NoError(t, err)
	})

	t.Run("SavePreferences for a user should store correct values with nav and query history", func(t *testing.T) {
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
			JSONData:        &pref.PreferenceJSONData{Navbar: userNavbarPreferences},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Patch for a user should store correct values", func(t *testing.T) {
		darkTheme := "dark"
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

		err := prefService.Patch(context.Background(),
			&pref.PatchPreferenceCommand{
				HomeDashboardID: &homeDashboardID,
				Timezone:        &timezone,
				WeekStart:       &weekStart,
				Navbar:          &emptyNavbarPreferences,
				QueryHistory:    &emptyQueryPreference,
			})
		require.NoError(t, err)
	})
}

func insertPrefs(t testing.TB, store store, preferences ...pref.Preference) {
	t.Helper()
	for _, p := range preferences {
		_, err := store.Insert(context.Background(), &p)
		require.NoError(t, err)
	}
}

type preferenceKey struct {
	OrgID  int64
	TeamID int64
	UserID int64
}

type storeFake struct {
	preference map[preferenceKey]pref.Preference
	idMap      map[int64]preferenceKey
	nextID     int64
}

func (s storeFake) Get(ctx context.Context, preference *pref.Preference) (*pref.Preference, error) {
	res, ok := s.preference[preferenceKey{
		OrgID:  preference.OrgID,
		TeamID: preference.TeamID,
		UserID: preference.UserID,
	}]
	if !ok {
		return nil, pref.ErrPrefNotFound
	}

	return &res, nil
}

func (s storeFake) List(ctx context.Context, preference *pref.Preference) ([]*pref.Preference, error) {
	res := []*pref.Preference{}

	p, ok := s.preference[preferenceKey{
		OrgID: preference.OrgID,
	}]
	if ok {
		res = append(res, &p)
	}

	sort.Slice(preference.Teams, func(i, j int) bool {
		return preference.Teams[i] < preference.Teams[j]
	})

	for _, t := range preference.Teams {
		p, ok := s.preference[preferenceKey{
			OrgID:  preference.OrgID,
			TeamID: t,
		}]
		if !ok {
			continue
		}

		res = append(res, &p)
	}

	if preference.UserID != 0 {
		p, ok := s.preference[preferenceKey{
			OrgID:  preference.OrgID,
			UserID: preference.UserID,
		}]
		if ok {
			res = append(res, &p)
		}
	}

	return res, nil
}

func (s storeFake) Insert(ctx context.Context, preference *pref.Preference) (int64, error) {
	key := preferenceKey{
		OrgID:  preference.OrgID,
		TeamID: preference.TeamID,
		UserID: preference.UserID,
	}

	var p pref.Preference = *preference
	p.ID = s.nextID
	s.nextID++

	if _, exists := s.preference[key]; exists {
		return 0, fmt.Errorf("conflict in fake, preference for [orgid=%d, userid=%d, teamid=%d] already exists", preference.OrgID, preference.UserID, preference.TeamID)
	}

	s.preference[key] = p
	s.idMap[p.ID] = key
	return p.ID, nil
}

func (s storeFake) Update(ctx context.Context, preference *pref.Preference) error {
	key, ok := s.idMap[preference.ID]
	if !ok {
		return pref.ErrPrefNotFound
	}

	s.preference[key] = *preference
	return nil
}

func newFake() store {
	return &storeFake{
		preference: map[preferenceKey]pref.Preference{},
		idMap:      map[int64]preferenceKey{},
		nextID:     1,
	}
}
