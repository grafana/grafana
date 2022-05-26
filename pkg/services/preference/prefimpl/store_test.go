//go:build integration
// +build integration

package prefimpl

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/models"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationPreferencesDataAccess(t *testing.T) {
	ss := sqlstore.InitTestDB(t)
	prefStore := sqlStore{db: ss}
	orgNavbarPreferences := pref.NavbarPreference{
		SavedItems: []pref.NavLink{{
			ID:   "alerting",
			Text: "Alerting",
			Url:  "/alerting",
		}},
	}

	t.Run("Get with saved org and user home dashboard returns not found", func(t *testing.T) {
		query := &pref.Preference{OrgID: 1, UserID: 1, TeamID: 2}
		prefs, err := prefStore.Get(context.Background(), query)
		require.EqualError(t, err, pref.ErrPrefNotFound.Error())
		require.Nil(t, prefs)
	})

	t.Run("Get with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(),
			&pref.Preference{
				OrgID:           1,
				UserID:          1,
				HomeDashboardID: 4,
				TeamID:          2,
				Created:         time.Now(),
				Updated:         time.Now(),
			})
		require.NoError(t, err)

		query := &pref.Preference{OrgID: 1, UserID: 1, TeamID: 2}
		prefs, err := prefStore.Get(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), prefs.HomeDashboardID)
	})

	t.Run("List with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(),
			&pref.Preference{
				OrgID:           1,
				UserID:          1,
				TeamID:          3,
				HomeDashboardID: 1,
				Created:         time.Now(),
				Updated:         time.Now(),
			})
		require.NoError(t, err)

		query := &pref.Preference{OrgID: 1, UserID: 1, Teams: []int64{2}}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), prefs[0].HomeDashboardID)
	})

	t.Run("List with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(),
			&pref.Preference{
				OrgID:           1,
				UserID:          2,
				TeamID:          3,
				HomeDashboardID: 1,
				Created:         time.Now(),
				Updated:         time.Now(),
			})
		require.NoError(t, err)

		query := &pref.Preference{OrgID: 1, UserID: 1, Teams: []int64{3}}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), prefs[0].HomeDashboardID)
		require.Equal(t, int64(1), prefs[1].HomeDashboardID)
	})

	t.Run("List with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
		query := &pref.Preference{
			OrgID: 1, Teams: []int64{2, 3},
		}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), prefs[0].HomeDashboardID)
		require.Equal(t, int64(1), prefs[1].HomeDashboardID)
		require.Equal(t, int64(1), prefs[2].HomeDashboardID)
	})

	t.Run("List with saved org and other teams home dashboard should return org home dashboard", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(), &pref.Preference{OrgID: 1, HomeDashboardID: 1, Created: time.Now(), Updated: time.Now()})
		require.NoError(t, err)
		_, err = prefStore.Insert(context.Background(), &pref.Preference{OrgID: 1, TeamID: 2, HomeDashboardID: 2, Created: time.Now(), Updated: time.Now()})
		require.NoError(t, err)
		_, err = prefStore.Insert(context.Background(), &pref.Preference{OrgID: 1, TeamID: 3, HomeDashboardID: 3, Created: time.Now(), Updated: time.Now()})
		require.NoError(t, err)

		query := &pref.Preference{OrgID: 1}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), prefs[0].HomeDashboardID)
	})

	t.Run("Update for a user should only modify a single value", func(t *testing.T) {
		ss := sqlstore.InitTestDB(t)
		prefStore := sqlStore{db: ss}
		id, err := prefStore.Insert(context.Background(), &pref.Preference{
			UserID:          models.SignedInUser{}.UserId,
			Theme:           "dark",
			Timezone:        "browser",
			HomeDashboardID: 5,
			WeekStart:       "1",
			JSONData:        &pref.PreferenceJSONData{Navbar: orgNavbarPreferences},
			Created:         time.Now(),
			Updated:         time.Now(),
		})
		require.NoError(t, err)

		err = prefStore.Update(context.Background(), &pref.Preference{
			ID:              id,
			Theme:           "dark",
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Created:         time.Now(),
			Updated:         time.Now(),
			JSONData:        &pref.PreferenceJSONData{},
		})
		require.NoError(t, err)
		query := &pref.Preference{}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			ID:              prefs[0].ID,
			Version:         prefs[0].Version,
			HomeDashboardID: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			JSONData:        prefs[0].JSONData,
			Created:         prefs[0].Created,
			Updated:         prefs[0].Updated,
		}
		if diff := cmp.Diff(expected, prefs[0]); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
	t.Run("insert preference that does not exist", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(),
			&pref.Preference{
				UserID:   models.SignedInUser{}.UserId,
				Created:  time.Now(),
				Updated:  time.Now(),
				JSONData: &pref.PreferenceJSONData{},
			})
		require.NoError(t, err)
	})
}
