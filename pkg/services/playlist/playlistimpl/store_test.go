package playlistimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationPlaylistDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ss := sqlstore.InitTestDB(t)
	playlistStore := sqlStore{db: ss}

	t.Run("Can create playlist", func(t *testing.T) {
		items := []playlist.PlaylistItemDTO{
			{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
			{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
		}
		cmd := playlist.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1, Items: items}
		p, err := playlistStore.Insert(context.Background(), &cmd)
		require.NoError(t, err)
		uid := p.UID

		t.Run("Can get playlist items", func(t *testing.T) {
			get := &playlist.GetPlaylistItemsByUidQuery{PlaylistUID: uid, OrgId: 1}
			storedPlaylistItems, err := playlistStore.GetItems(context.Background(), get)
			require.NoError(t, err)
			require.Equal(t, len(storedPlaylistItems), len(items))
		})

		t.Run("Get playlist that doesn't exist", func(t *testing.T) {
			get := &playlist.GetPlaylistByUidQuery{UID: "unknown", OrgId: 1}
			_, err := playlistStore.Get(context.Background(), get)
			require.Error(t, err)
			require.ErrorIs(t, err, playlist.ErrPlaylistNotFound)
		})

		t.Run("Can update playlist", func(t *testing.T) {
			items := []playlist.PlaylistItemDTO{
				{Title: "influxdb", Value: "influxdb", Type: "dashboard_by_tag"},
				{Title: "Backend response times", Value: "2", Type: "dashboard_by_id"},
			}
			query := playlist.UpdatePlaylistCommand{Name: "NYC office ", OrgId: 1, UID: uid, Interval: "10s", Items: items}
			_, err = playlistStore.Update(context.Background(), &query)
			require.NoError(t, err)
		})

		t.Run("Can remove playlist", func(t *testing.T) {
			deleteQuery := playlist.DeletePlaylistCommand{UID: uid, OrgId: 1}
			err = playlistStore.Delete(context.Background(), &deleteQuery)
			require.NoError(t, err)

			getQuery := playlist.GetPlaylistByUidQuery{UID: uid, OrgId: 1}
			p, err := playlistStore.Get(context.Background(), &getQuery)
			require.Error(t, err)
			require.Equal(t, uid, p.UID, "playlist should've been removed")
			require.ErrorIs(t, err, playlist.ErrPlaylistNotFound)
		})
	})

	t.Run("Delete playlist that doesn't exist", func(t *testing.T) {
		deleteQuery := playlist.DeletePlaylistCommand{UID: "654312", OrgId: 1}
		err := playlistStore.Delete(context.Background(), &deleteQuery)
		require.NoError(t, err)
	})

	t.Run("Delete playlist with invalid command yields error", func(t *testing.T) {
		testCases := []struct {
			desc string
			cmd  playlist.DeletePlaylistCommand
		}{
			{desc: "none", cmd: playlist.DeletePlaylistCommand{}},
			{desc: "no OrgId", cmd: playlist.DeletePlaylistCommand{UID: "1"}},
			{desc: "no Uid", cmd: playlist.DeletePlaylistCommand{OrgId: 1}},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				err := playlistStore.Delete(context.Background(), &tc.cmd)
				require.EqualError(t, err, playlist.ErrCommandValidationFailed.Error())
			})
		}
	})
}
