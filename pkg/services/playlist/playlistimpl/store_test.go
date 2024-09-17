package playlistimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type getStore func(db.DB) store

func testIntegrationPlaylistDataAccess(t *testing.T, fn getStore) {
	t.Helper()

	start := time.Now().UnixMilli()
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
			require.GreaterOrEqual(t, pl.CreatedAt, start)
			require.GreaterOrEqual(t, pl.UpdatedAt, start)
		})

		t.Run("Can get playlist items", func(t *testing.T) {
			get := &playlist.GetPlaylistItemsByUidQuery{PlaylistUID: uid, OrgId: 1}
			storedPlaylistItems, err := playlistStore.GetItems(context.Background(), get)
			require.NoError(t, err)
			require.Equal(t, len(items), len(storedPlaylistItems))
		})

		t.Run("Can update playlist", func(t *testing.T) {
			time.Sleep(time.Millisecond * 2)
			items := []playlist.PlaylistItem{
				{Title: "influxdb", Value: "influxdb", Type: "dashboard_by_tag"},
				{Title: "Backend response times", Value: "2", Type: "dashboard_by_id"},
			}
			query := playlist.UpdatePlaylistCommand{Name: "NYC office ", OrgId: 1, UID: uid, Interval: "10s", Items: items}
			_, err = playlistStore.Update(context.Background(), &query)
			require.NoError(t, err)

			// Now check that UpdatedAt has increased
			pl, err := playlistStore.Get(context.Background(), &playlist.GetPlaylistByUidQuery{UID: uid, OrgId: 1})
			require.NoError(t, err)
			require.Equal(t, p.Id, pl.Id)
			require.Equal(t, p.CreatedAt, pl.CreatedAt)
			require.Greater(t, pl.UpdatedAt, p.UpdatedAt)
			require.Greater(t, pl.UpdatedAt, pl.CreatedAt)
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

	t.Run("Can create playlist with known UID", func(t *testing.T) {
		items := []playlist.PlaylistItem{
			{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
			{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
		}
		cmd := playlist.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1,
			Items: items,
			UID:   "abcd",
		}
		p, err := playlistStore.Insert(context.Background(), &cmd)
		require.NoError(t, err)
		require.Equal(t, "abcd", p.UID)

		// Should get an error with an invalid UID
		cmd.UID = "invalid uid"
		_, err = playlistStore.Insert(context.Background(), &cmd)
		require.Error(t, err)

		// cleanup
		err = playlistStore.Delete(context.Background(), &playlist.DeletePlaylistCommand{
			OrgId: 1,
			UID:   "abcd",
		})
		require.NoError(t, err)
	})

	t.Run("Search playlist", func(t *testing.T) {
		startTime := time.Now().UnixMilli()
		time.Sleep(time.Millisecond * 20)

		items := []playlist.PlaylistItem{
			{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
			{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
		}
		pl1 := playlist.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1, Items: items}
		pl2 := playlist.CreatePlaylistCommand{Name: "NICE office", Interval: "10m", OrgId: 1, Items: items}
		pl3 := playlist.CreatePlaylistCommand{Name: "NICE office", Interval: "10m", OrgId: 2, Items: items}
		_, err := playlistStore.Insert(context.Background(), &pl1)
		require.NoError(t, err)
		time.Sleep(time.Millisecond * 20)
		_, err = playlistStore.Insert(context.Background(), &pl2)
		require.NoError(t, err)
		time.Sleep(time.Millisecond * 20)
		_, err = playlistStore.Insert(context.Background(), &pl3)
		require.NoError(t, err)
		time.Sleep(time.Millisecond * 20)

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

		t.Run("With FullList support", func(t *testing.T) {
			res, err := playlistStore.ListAll(context.Background(), 1)
			require.NoError(t, err)

			// Make sure the timestamps came through OK (the risk with SQLX)
			offsetTime := startTime
			for id, v := range res {
				res[id].Uid = fmt.Sprintf("ROW:%d", id) // normalize for JSON test

				elapsed := v.CreatedAt - offsetTime
				require.Greater(t, v.CreatedAt, startTime)
				require.Greater(t, elapsed, int64(10)) // sleeps 20ms
				offsetTime = v.CreatedAt
			}

			jj, err := json.MarshalIndent(res, "", "  ")
			require.NoError(t, err)
			//fmt.Printf("OUT:%s\n", string(jj))

			// Each row has a full payload
			require.JSONEq(t, `[
				{
				  "uid": "ROW:0",
				  "name": "NYC office",
				  "interval": "10m",
				  "items": [
					{
					  "type": "dashboard_by_tag",
					  "value": "graphite"
					},
					{
					  "type": "dashboard_by_id",
					  "value": "3"
					}
				  ]
				},
				{
				  "uid": "ROW:1",
				  "name": "NICE office",
				  "interval": "10m",
				  "items": [
					{
					  "type": "dashboard_by_tag",
					  "value": "graphite"
					},
					{
					  "type": "dashboard_by_id",
					  "value": "3"
					}
				  ]
				}
			  ]`, string(jj))
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
