//go:build integration
// +build integration

package playlistimpl

import (
	"context"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestPlaylistDataAccess(t *testing.T) {
	ss := ProvideService(sqlstore.InitTestDB(t))

	t.Run("Can create playlist", func(t *testing.T) {
		items := []playlist.PlaylistItemDTO{
			{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
			{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
		}
		cmd := playlist.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1, Items: items}
		_, err := ss.CreatePlaylist(context.Background(), &cmd)
		require.NoError(t, err)

		t.Run("Can update playlist", func(t *testing.T) {
			items := []playlist.PlaylistItemDTO{
				{Title: "influxdb", Value: "influxdb", Type: "dashboard_by_tag"},
				{Title: "Backend response times", Value: "2", Type: "dashboard_by_id"},
			}
			query := playlist.UpdatePlaylistCommand{Name: "NYC office ", OrgId: 1, Id: 1, Interval: "10s", Items: items}
			_, err = ss.UpdatePlaylist(context.Background(), &query)
			require.NoError(t, err)
		})

		t.Run("Can remove playlist", func(t *testing.T) {
			deleteQuery := playlist.DeletePlaylistCommand{Id: 1, OrgId: 1}
			err = ss.DeletePlaylist(context.Background(), &deleteQuery)
			require.NoError(t, err)

			getQuery := playlist.GetPlaylistByIdQuery{Id: 1}
			result, err := ss.GetPlaylist(context.Background(), &getQuery)
			require.NoError(t, err)
			require.Equal(t, int64(0), result.Id, "playlist should've been removed")
		})
	})

	t.Run("Delete playlist that doesn't exist", func(t *testing.T) {
		deleteQuery := playlist.DeletePlaylistCommand{Id: 1, OrgId: 1}
		err := ss.DeletePlaylist(context.Background(), &deleteQuery)
		require.NoError(t, err)
	})

	t.Run("Delete playlist with invalid command yields error", func(t *testing.T) {
		testCases := []struct {
			desc string
			cmd  playlist.DeletePlaylistCommand
		}{
			{desc: "none", cmd: playlist.DeletePlaylistCommand{}},
			{desc: "no OrgId", cmd: playlist.DeletePlaylistCommand{Id: 1}},
			{desc: "no Id", cmd: playlist.DeletePlaylistCommand{OrgId: 1}},
		}

		for _, tc := range testCases {
			t.Run(tc.desc, func(t *testing.T) {
				err := ss.DeletePlaylist(context.Background(), &tc.cmd)
				require.EqualError(t, err, models.ErrCommandValidationFailed.Error())
			})
		}
	})
}
