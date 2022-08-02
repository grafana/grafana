package sqlstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

func TestIntegrationPlaylistDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ss := InitTestDB(t)

	t.Run("Can create playlist", func(t *testing.T) {
		items := []models.PlaylistItemDTO{
			{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
			{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
		}
		cmd := models.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1, Items: items}
		err := ss.CreatePlaylist(context.Background(), &cmd)
		require.NoError(t, err)
		uid := cmd.Result.UID

		t.Run("Can get playlist", func(t *testing.T) {
			get := &models.GetPlaylistByUidQuery{UID: uid, OrgId: 1}
			err = ss.GetPlaylist(context.Background(), get)
			require.NoError(t, err)
			require.NotNil(t, get.Result)
			require.Equal(t, get.Result.Name, "NYC office")
			require.Equal(t, get.Result.Interval, "10m")
		})

		t.Run("Can get playlist items", func(t *testing.T) {
			get := &models.GetPlaylistItemsByUidQuery{PlaylistUID: uid, OrgId: 1}
			err = ss.GetPlaylistItem(context.Background(), get)
			require.NoError(t, err)
			require.Equal(t, len(*get.Result), len(items))
		})

		t.Run("Can update playlist", func(t *testing.T) {
			items := []models.PlaylistItemDTO{
				{Title: "influxdb", Value: "influxdb", Type: "dashboard_by_tag"},
				{Title: "Backend response times", Value: "2", Type: "dashboard_by_id"},
			}
			query := models.UpdatePlaylistCommand{Name: "NYC office ", OrgId: 1, UID: uid, Interval: "10s", Items: items}
			err = ss.UpdatePlaylist(context.Background(), &query)
			require.NoError(t, err)
		})

		t.Run("Can remove playlist", func(t *testing.T) {
			deleteQuery := models.DeletePlaylistCommand{UID: uid, OrgId: 1}
			err = ss.DeletePlaylist(context.Background(), &deleteQuery)
			require.NoError(t, err)

			getQuery := models.GetPlaylistByUidQuery{UID: uid, OrgId: 1}
			err = ss.GetPlaylist(context.Background(), &getQuery)
			require.Error(t, err)
			require.ErrorIs(t, err, models.ErrPlaylistNotFound)
		})
	})

	t.Run("Get playlist that doesn't exist", func(t *testing.T) {
		get := &models.GetPlaylistByUidQuery{UID: "unknown", OrgId: 1}
		err := ss.GetPlaylist(context.Background(), get)
		require.Error(t, err)
		require.ErrorIs(t, err, models.ErrPlaylistNotFound)
	})

	t.Run("Delete playlist that doesn't exist", func(t *testing.T) {
		deleteQuery := models.DeletePlaylistCommand{UID: "654312", OrgId: 1}
		err := ss.DeletePlaylist(context.Background(), &deleteQuery)
		require.NoError(t, err)
	})

	t.Run("Delete playlist with invalid command yields error", func(t *testing.T) {
		testCases := []struct {
			desc string
			cmd  models.DeletePlaylistCommand
		}{
			{desc: "none", cmd: models.DeletePlaylistCommand{}},
			{desc: "no OrgId", cmd: models.DeletePlaylistCommand{UID: "1"}},
			{desc: "no Uid", cmd: models.DeletePlaylistCommand{OrgId: 1}},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				err := ss.DeletePlaylist(context.Background(), &tc.cmd)
				require.EqualError(t, err, models.ErrCommandValidationFailed.Error())
			})
		}
	})
}
