package prefimpl

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type getStore func(db.DB) store

func testIntegrationPreferencesDataAccess(t *testing.T, fn getStore) {
	t.Helper()
	weekStartOne := "1"
	ss := db.InitTestDB(t)
	prefStore := fn(ss)

	t.Run("Get with saved org and user home dashboard returns not found", func(t *testing.T) {
		query := &pref.Preference{OrgID: 1, UserID: 1, TeamID: 2}
		prefs, err := prefStore.Get(context.Background(), query)
		require.EqualError(t, err, pref.ErrPrefNotFound.Error())
		require.Nil(t, prefs)
	})

	t.Run("Get with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(),
			&pref.Preference{
				OrgID:            1,
				UserID:           1,
				HomeDashboardID:  4, // nolint:staticcheck
				HomeDashboardUID: "test-uid4",
				TeamID:           2,
				Created:          time.Now(),
				Updated:          time.Now(),
			})
		require.NoError(t, err)

		query := &pref.Preference{OrgID: 1, UserID: 1, TeamID: 2}
		prefs, err := prefStore.Get(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), prefs.HomeDashboardID) // nolint:staticcheck
		require.Equal(t, "test-uid4", prefs.HomeDashboardUID)
	})

	t.Run("List with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(),
			&pref.Preference{
				OrgID:            1,
				UserID:           1,
				TeamID:           3,
				HomeDashboardID:  1, // nolint:staticcheck
				HomeDashboardUID: "test-uid1",
				Created:          time.Now(),
				Updated:          time.Now(),
			})
		require.NoError(t, err)

		query := &pref.Preference{OrgID: 1, UserID: 1, Teams: []int64{2}}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), prefs[0].HomeDashboardID) // nolint:staticcheck
		require.Equal(t, "test-uid4", prefs[0].HomeDashboardUID)
	})

	t.Run("List with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(),
			&pref.Preference{
				OrgID:            1,
				UserID:           2,
				TeamID:           3,
				HomeDashboardID:  1, // nolint:staticcheck
				HomeDashboardUID: "test-uid1",
				Created:          time.Now(),
				Updated:          time.Now(),
			})
		require.NoError(t, err)

		query := &pref.Preference{OrgID: 1, UserID: 1, Teams: []int64{3}}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), prefs[0].HomeDashboardID) // nolint:staticcheck
		require.Equal(t, int64(1), prefs[1].HomeDashboardID) // nolint:staticcheck
		require.Equal(t, "test-uid1", prefs[0].HomeDashboardUID)
		require.Equal(t, "test-uid1", prefs[1].HomeDashboardUID)
	})

	t.Run("List with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
		query := &pref.Preference{
			OrgID: 1, Teams: []int64{2, 3},
		}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), prefs[0].HomeDashboardID) // nolint:staticcheck
		require.Equal(t, int64(1), prefs[1].HomeDashboardID) // nolint:staticcheck
		require.Equal(t, int64(1), prefs[2].HomeDashboardID) // nolint:staticcheck
		require.Equal(t, "test-uid4", prefs[0].HomeDashboardUID)
		require.Equal(t, "test-uid1", prefs[1].HomeDashboardUID)
		require.Equal(t, "test-uid1", prefs[2].HomeDashboardUID)
	})

	t.Run("List with saved org and other teams home dashboard should return org home dashboard", func(t *testing.T) {
		// nolint:staticcheck
		_, err := prefStore.Insert(context.Background(), &pref.Preference{OrgID: 1, HomeDashboardID: 1, HomeDashboardUID: "test-uid1", Created: time.Now(), Updated: time.Now()})
		require.NoError(t, err)
		// nolint:staticcheck
		_, err = prefStore.Insert(context.Background(), &pref.Preference{OrgID: 1, TeamID: 2, HomeDashboardID: 2, HomeDashboardUID: "test-uid2", Created: time.Now(), Updated: time.Now()})
		require.NoError(t, err)
		// nolint:staticcheck
		_, err = prefStore.Insert(context.Background(), &pref.Preference{OrgID: 1, TeamID: 3, HomeDashboardID: 3, HomeDashboardUID: "test-uid3", Created: time.Now(), Updated: time.Now()})
		require.NoError(t, err)

		query := &pref.Preference{OrgID: 1}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), prefs[0].HomeDashboardID) // nolint:staticcheck
		require.Equal(t, "test-uid1", prefs[0].HomeDashboardUID)
	})

	t.Run("Update for a user should only modify a single value", func(t *testing.T) {
		ss := db.InitTestDB(t)
		prefStore := fn(ss)
		id, err := prefStore.Insert(context.Background(), &pref.Preference{
			UserID:           user.SignedInUser{}.UserID,
			Theme:            "dark",
			Timezone:         "browser",
			HomeDashboardID:  5, // nolint:staticcheck
			HomeDashboardUID: "test-uid5",
			WeekStart:        &weekStartOne,
			JSONData:         &pref.PreferenceJSONData{},
			Created:          time.Now(),
			Updated:          time.Now(),
		})
		require.NoError(t, err)

		err = prefStore.Update(context.Background(), &pref.Preference{
			ID:               id,
			Theme:            "dark",
			HomeDashboardID:  5, // nolint:staticcheck
			HomeDashboardUID: "test-uid5",
			Timezone:         "browser",
			WeekStart:        &weekStartOne,
			Created:          time.Now(),
			Updated:          time.Now(),
			JSONData:         &pref.PreferenceJSONData{},
		})
		require.NoError(t, err)
		query := &pref.Preference{}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preference{
			ID:               prefs[0].ID,
			Version:          prefs[0].Version,
			HomeDashboardID:  5, // nolint:staticcheck
			HomeDashboardUID: "test-uid5",
			Timezone:         "browser",
			WeekStart:        &weekStartOne,
			Theme:            "dark",
			JSONData:         prefs[0].JSONData,
			Created:          prefs[0].Created,
			Updated:          prefs[0].Updated,
		}
		if diff := cmp.Diff(expected, prefs[0]); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
	t.Run("insert preference that does not exist", func(t *testing.T) {
		_, err := prefStore.Insert(context.Background(),
			&pref.Preference{
				UserID:   user.SignedInUser{}.UserID,
				Created:  time.Now(),
				Updated:  time.Now(),
				JSONData: &pref.PreferenceJSONData{},
			})
		require.NoError(t, err)
	})
	t.Run("delete preference by user", func(t *testing.T) {
		err := prefStore.DeleteByUser(context.Background(), user.SignedInUser{}.UserID)
		require.NoError(t, err)
		query := &pref.Preference{OrgID: 0, UserID: user.SignedInUser{}.UserID, TeamID: 0}
		_, err = prefStore.Get(context.Background(), query)
		require.EqualError(t, err, pref.ErrPrefNotFound.Error())
	})
}
