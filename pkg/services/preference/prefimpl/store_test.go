package prefimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/models"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestPreferencesDataAccess(t *testing.T) {
	ss := sqlstore.InitTestDB(t)
	prefStore := sqlStore{db: ss}
	orgNavbarPreferences := pref.NavbarPreference{
		SavedItems: []pref.NavLink{{
			Id:   "alerting",
			Text: "Alerting",
			Url:  "/alerting",
		}},
	}

	t.Run("Get with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, UserID: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &pref.GetPreferenceQuery{OrgID: 1, UserID: 1}
		prefs, err := prefStore.Get(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(4), prefs.HomeDashboardId)
	})

	t.Run("List with saved org and user home dashboard should return user home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, UserID: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &pref.ListPreferenceQuery{OrgID: 1, UserID: 1}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), prefs[0].HomeDashboardId)
		require.Equal(t, int64(4), prefs[1].HomeDashboardId)
	})

	t.Run("List with saved org and other user home dashboard should return org home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, UserID: 1, HomeDashboardId: 4})
		require.NoError(t, err)

		query := &pref.ListPreferenceQuery{OrgID: 1, UserID: 2}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), prefs[0].HomeDashboardId)
	})

	t.Run("List with saved org and teams home dashboard should return last team home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, TeamID: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, TeamID: 3, HomeDashboardId: 3})
		require.NoError(t, err)

		query := &pref.ListPreferenceQuery{
			OrgID: 1, Teams: []int64{2, 3},
		}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), prefs[0].HomeDashboardId)
		require.Equal(t, int64(2), prefs[1].HomeDashboardId)
		require.Equal(t, int64(3), prefs[2].HomeDashboardId)
	})

	t.Run("List with saved org and other teams home dashboard should return org home dashboard", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, HomeDashboardId: 1})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, TeamID: 2, HomeDashboardId: 2})
		require.NoError(t, err)
		err = prefStore.Set(context.Background(), &pref.SavePreferenceCommand{OrgID: 1, TeamID: 3, HomeDashboardId: 3})
		require.NoError(t, err)

		query := &pref.ListPreferenceQuery{OrgID: 1}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, int64(1), prefs[0].HomeDashboardId)
	})

	t.Run("Patch for a user should only modify a single value", func(t *testing.T) {
		err := prefStore.Set(context.Background(), &pref.SavePreferenceCommand{UserID: models.SignedInUser{}.UserId, Theme: "dark", Timezone: "browser", HomeDashboardId: 5, WeekStart: "1", Navbar: &orgNavbarPreferences})
		require.NoError(t, err)

		err = prefStore.Upsert(
			context.Background(),
			&pref.Preferences{
				UserId:   models.SignedInUser{}.UserId,
				JsonData: &pref.PreferencesJsonData{},
			}, true)
		require.NoError(t, err)
		query := &pref.ListPreferenceQuery{}
		prefs, err := prefStore.List(context.Background(), query)
		require.NoError(t, err)
		expected := &pref.Preferences{
			Id:              prefs[0].Id,
			Version:         prefs[0].Version,
			HomeDashboardId: 5,
			Timezone:        "browser",
			WeekStart:       "1",
			Theme:           "dark",
			JsonData:        prefs[0].JsonData,
			Created:         prefs[0].Created,
			Updated:         prefs[0].Updated,
		}
		fmt.Println(prefs[0].JsonData)
		if diff := cmp.Diff(expected, prefs[0]); diff != "" {
			t.Fatalf("Result mismatch (-want +got):\n%s", diff)
		}
	})
	t.Run("upsert preference that does not exist", func(t *testing.T) {
		err := prefStore.Upsert(context.Background(),
			&pref.Preferences{
				UserId:   models.SignedInUser{}.UserId,
				Created:  time.Now(),
				Updated:  time.Now(),
				JsonData: &pref.PreferencesJsonData{},
			},
			false)
		require.NoError(t, err)
	})
}
