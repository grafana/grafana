package prefimpl

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGet_empty(t *testing.T) {
	prefService := &Service{
		store:    newFake(),
		cfg:      setting.NewCfg(),
		features: featuremgmt.WithFeatures(),
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
		store:    newFake(),
		cfg:      setting.NewCfg(),
		features: featuremgmt.WithFeatures(),
	}
	prefService.cfg.DefaultLanguage = "en-US"
	prefService.cfg.DefaultTheme = "light"
	prefService.cfg.DateFormats.DefaultTimezone = "UTC"
	weekStart := ""

	t.Run("GetDefaults", func(t *testing.T) {
		preference := prefService.GetDefaults()
		expected := &pref.Preference{
			WeekStart:       &weekStart,
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
			WeekStart:       &weekStart,
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardID: 0,
			JSONData:        &pref.PreferenceJSONData{},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestGetDefaultsWithI18nFeatureFlag(t *testing.T) {
	prefService := &Service{
		store:    newFake(),
		cfg:      setting.NewCfg(),
		features: featuremgmt.WithFeatures(featuremgmt.FlagInternationalization),
	}
	weekStart := ""
	prefService.cfg.DefaultLanguage = "en-US"
	prefService.cfg.DefaultTheme = "light"
	prefService.cfg.DateFormats.DefaultTimezone = "UTC"

	t.Run("GetDefaults", func(t *testing.T) {
		preference := prefService.GetDefaults()
		expected := &pref.Preference{
			WeekStart:       &weekStart,
			Theme:           "light",
			Timezone:        "UTC",
			HomeDashboardID: 0,
			JSONData: &pref.PreferenceJSONData{
				Language: "en-US",
			},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestGetWithDefaults_withUserAndOrgPrefs(t *testing.T) {
	prefService := &Service{
		store:    newFake(),
		cfg:      setting.NewCfg(),
		features: featuremgmt.WithFeatures(),
	}
	prefService.cfg.DefaultLanguage = "en-US"

	weekStartOne := "1"
	weekStartTwo := "2"
	insertPrefs(t, prefService.store,
		pref.Preference{
			OrgID:           1,
			HomeDashboardID: 1,
			Theme:           "dark",
			Timezone:        "UTC",
			WeekStart:       &weekStartOne,
			JSONData: &pref.PreferenceJSONData{
				Language: "en-GB",
			},
		},
		pref.Preference{
			OrgID:           1,
			UserID:          1,
			HomeDashboardID: 4,
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       &weekStartTwo,
			JSONData: &pref.PreferenceJSONData{
				Language: "en-AU",
			},
		},
	)

	t.Run("prefer user's preferences", func(t *testing.T) {
		query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, UserID: 1}
		preference, err := prefService.GetWithDefaults(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       &weekStartTwo,
			HomeDashboardID: 4,
			JSONData: &pref.PreferenceJSONData{
				Language: "en-AU",
			},
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
			WeekStart:       &weekStartOne,
			HomeDashboardID: 1,
			JSONData: &pref.PreferenceJSONData{
				Language: "en-GB",
			},
		}
		if diff := cmp.Diff(expected, preference); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestGetDefaults_JSONData(t *testing.T) {
	weekStart := ""
	queryPreference := pref.QueryHistoryPreference{
		HomeTab: "hometab",
	}
	userPreferencesJsonData := pref.PreferenceJSONData{
		QueryHistory: queryPreference,
	}
	orgPreferencesJsonData := pref.PreferenceJSONData{}
	orgPreferencesWithLanguageJsonData := pref.PreferenceJSONData{
		Language: "en-GB",
	}
	team2PreferencesJsonData := pref.PreferenceJSONData{}
	team1PreferencesJsonData := pref.PreferenceJSONData{}

	t.Run("users have precedence over org", func(t *testing.T) {
		prefService := &Service{
			store:    newFake(),
			cfg:      setting.NewCfg(),
			features: featuremgmt.WithFeatures(),
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
			WeekStart: &weekStart,
			JSONData:  &userPreferencesJsonData,
		}, preference)
	})

	t.Run("user JSONData with missing language does not override org preference", func(t *testing.T) {
		prefService := &Service{
			store:    newFake(),
			cfg:      setting.NewCfg(),
			features: featuremgmt.WithFeatures(),
		}

		insertPrefs(t, prefService.store,
			pref.Preference{
				OrgID:    1,
				JSONData: &orgPreferencesWithLanguageJsonData,
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
			WeekStart: &weekStart,
			JSONData: &pref.PreferenceJSONData{
				Language:     "en-GB",
				QueryHistory: queryPreference,
			},
		}, preference)
	})

	t.Run("teams have precedence over org and are read in ascending order", func(t *testing.T) {
		prefService := &Service{
			store:    newFake(),
			cfg:      setting.NewCfg(),
			features: featuremgmt.WithFeatures(),
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
			JSONData:  &team2PreferencesJsonData,
			WeekStart: &weekStart,
		}, preference)
	})
}

func TestGetWithDefaults_teams(t *testing.T) {
	weekStartOne := "1"
	weekStartTwo := "2"
	prefService := &Service{
		store:    newFake(),
		cfg:      setting.NewCfg(),
		features: featuremgmt.WithFeatures(),
	}
	insertPrefs(t, prefService.store,
		pref.Preference{
			OrgID:           1,
			HomeDashboardID: 1,
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       &weekStartOne,
		},
		pref.Preference{
			OrgID:           1,
			TeamID:          2,
			HomeDashboardID: 3,
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       &weekStartTwo,
		},
		pref.Preference{
			OrgID:           1,
			TeamID:          3,
			HomeDashboardID: 4,
			Theme:           "light",
			Timezone:        "browser",
			WeekStart:       &weekStartTwo,
		},
	)

	query := &pref.GetPreferenceWithDefaultsQuery{OrgID: 1, Teams: []int64{2, 3}}
	preferences, err := prefService.GetWithDefaults(context.Background(), query)
	require.NoError(t, err)
	expected := &pref.Preference{
		Theme:           "light",
		Timezone:        "browser",
		WeekStart:       &weekStartTwo,
		HomeDashboardID: 4,
		JSONData:        &pref.PreferenceJSONData{},
	}
	if diff := cmp.Diff(expected, preferences); diff != "" {
		t.Fatalf("Result mismatch (-want +got):\n%s", diff)
	}
}

func TestPatch_toCreate(t *testing.T) {
	prefService := &Service{
		store:    newFake(),
		cfg:      setting.NewCfg(),
		features: featuremgmt.WithFeatures(),
	}

	themeValue := "light"
	err := prefService.Patch(context.Background(), &pref.PatchPreferenceCommand{
		OrgID:  1,
		UserID: 2,
		Theme:  &themeValue,
	})
	require.NoError(t, err)

	stored := prefService.store.(*inmemStore).preference[preferenceKey{OrgID: 1, UserID: 2}]
	assert.EqualValues(t, 1, stored.OrgID)
	assert.EqualValues(t, 2, stored.UserID)
	assert.Equal(t, "light", stored.Theme)
}

func TestSave(t *testing.T) {
	prefService := &Service{
		store:    newFake(),
		cfg:      setting.NewCfg(),
		features: featuremgmt.WithFeatures(),
	}

	t.Run("insert", func(t *testing.T) {
		err := prefService.Save(context.Background(),
			&pref.SavePreferenceCommand{
				OrgID:           1,
				Theme:           "dark",
				Timezone:        "browser",
				HomeDashboardID: 5,
				WeekStart:       "1",
			},
		)
		require.NoError(t, err)

		stored := prefService.store.(*inmemStore).preference[preferenceKey{OrgID: 1}]
		assert.EqualValues(t, 1, stored.OrgID)
		assert.Zero(t, stored.UserID)
		assert.Zero(t, stored.TeamID)
		assert.Equal(t, "dark", stored.Theme)
		assert.Equal(t, "browser", stored.Timezone)
		assert.EqualValues(t, 5, stored.HomeDashboardID)
		assert.Equal(t, "1", *stored.WeekStart)
		assert.EqualValues(t, 0, stored.Version)
	})

	t.Run("update", func(t *testing.T) {
		err := prefService.Save(context.Background(),
			&pref.SavePreferenceCommand{
				OrgID:           1,
				Timezone:        "UTC",
				HomeDashboardID: 0,
				WeekStart:       "1",
			},
		)
		require.NoError(t, err)

		stored := prefService.store.(*inmemStore).preference[preferenceKey{OrgID: 1}]
		assert.EqualValues(t, 1, stored.OrgID)
		assert.Zero(t, stored.UserID)
		assert.Zero(t, stored.TeamID)
		assert.Empty(t, stored.Theme)
		assert.Equal(t, "UTC", stored.Timezone)
		assert.Zero(t, stored.HomeDashboardID)
		assert.Equal(t, "1", *stored.WeekStart)
		assert.EqualValues(t, 1, stored.Version)
	})

	t.Run("patch", func(t *testing.T) {
		themeValue := "light"
		err := prefService.Patch(context.Background(), &pref.PatchPreferenceCommand{
			OrgID: 1,
			Theme: &themeValue,
		})
		require.NoError(t, err)

		stored := prefService.store.(*inmemStore).preference[preferenceKey{OrgID: 1}]
		assert.EqualValues(t, 1, stored.OrgID)
		assert.Zero(t, stored.UserID)
		assert.Zero(t, stored.TeamID)
		assert.Equal(t, themeValue, stored.Theme)
		assert.Equal(t, "UTC", stored.Timezone)
		assert.Zero(t, stored.HomeDashboardID)
		assert.Equal(t, "1", *stored.WeekStart)
		assert.EqualValues(t, 2, stored.Version)
	})
}

func insertPrefs(t testing.TB, store store, preferences ...pref.Preference) {
	t.Helper()
	for _, p := range preferences {
		p := p
		_, err := store.Insert(context.Background(), &p)
		require.NoError(t, err)
	}
}

func newFake() store {
	return &inmemStore{
		preference: map[preferenceKey]pref.Preference{},
		idMap:      map[int64]preferenceKey{},
		nextID:     1,
	}
}
