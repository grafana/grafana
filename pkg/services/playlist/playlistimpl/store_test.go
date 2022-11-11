package playlistimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/playlist"
)

type getStore func(db.DB) store

func testIntegrationPlaylistDataAccess(t *testing.T, fn getStore) {
	t.Helper()

	ss := db.InitTestDB(t)
	playlistStore := fn(ss)

	t.Run("Can create playlist", func(t *testing.T) {
		items := []playlist.PlaylistItem{
			{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
			{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
		}
		cmd := playlist.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1, Items: items}
		p, err := playlistStore.Insert(context.Background(), &cmd)
		require.NoError(t, err)
		uid := p.UID

		t.Run("Can get playlist", func(t *testing.T) {
			get := &playlist.GetPlaylistByUidQuery{UID: uid, OrgId: 1}
			pl, err := playlistStore.Get(context.Background(), get)
			require.NoError(t, err)
			require.Equal(t, p.Id, pl.Id)
		})

		t.Run("Can get playlist items", func(t *testing.T) {
			get := &playlist.GetPlaylistItemsByUidQuery{PlaylistUID: uid, OrgId: 1}
			storedPlaylistItems, err := playlistStore.GetItems(context.Background(), get)
			require.NoError(t, err)
			require.Equal(t, len(items), len(storedPlaylistItems))
		})

		t.Run("Can update playlist", func(t *testing.T) {
			items := []playlist.PlaylistItem{
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
			_, err := playlistStore.Get(context.Background(), &getQuery)
			require.Error(t, err)
			require.ErrorIs(t, err, playlist.ErrPlaylistNotFound)
		})
	})

	t.Run("Search playlist", func(t *testing.T) {
		items := []playlist.PlaylistItem{
			{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
			{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
		}
		pl1 := playlist.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1, Items: items}
		pl2 := playlist.CreatePlaylistCommand{Name: "NICE office", Interval: "10m", OrgId: 1, Items: items}
		pl3 := playlist.CreatePlaylistCommand{Name: "NICE office", Interval: "10m", OrgId: 2, Items: items}
		_, err := playlistStore.Insert(context.Background(), &pl1)
		require.NoError(t, err)
		_, err = playlistStore.Insert(context.Background(), &pl2)
		require.NoError(t, err)
		_, err = playlistStore.Insert(context.Background(), &pl3)
		require.NoError(t, err)

		t.Run("With Org ID", func(t *testing.T) {
			qr := playlist.GetPlaylistsQuery{Limit: 100, OrgId: 1}
			res, err := playlistStore.List(context.Background(), &qr)

			require.NoError(t, err)
			require.Equal(t, 2, len(res))
		})
		t.Run("With Limit", func(t *testing.T) {
			qr := playlist.GetPlaylistsQuery{Limit: 1, Name: "office", OrgId: 1}
			res, err := playlistStore.List(context.Background(), &qr)
			require.NoError(t, err)
			require.Equal(t, 1, len(res))
		})
		t.Run("With Org ID and Name", func(t *testing.T) {
			qr := playlist.GetPlaylistsQuery{Limit: 100, Name: "office", OrgId: 1}
			res, err := playlistStore.List(context.Background(), &qr)
			require.NoError(t, err)
			require.Equal(t, 2, len(res))
		})
	})

	t.Run("Delete playlist that doesn't exist, should not return error", func(t *testing.T) {
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
