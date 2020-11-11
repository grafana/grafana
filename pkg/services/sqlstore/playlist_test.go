// +build integration

package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestPlaylistDataAccess(t *testing.T) {
	InitTestDB(t)

	t.Run("Can create playlist", func(t *testing.T) {
		items := []models.PlaylistItemDTO{
			{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
			{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
		}
		cmd := models.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1, Items: items}
		err := CreatePlaylist(&cmd)
		require.NoError(t, err)

		t.Run("Can update playlist", func(t *testing.T) {
			items := []models.PlaylistItemDTO{
				{Title: "influxdb", Value: "influxdb", Type: "dashboard_by_tag"},
				{Title: "Backend response times", Value: "2", Type: "dashboard_by_id"},
			}
			query := models.UpdatePlaylistCommand{Name: "NYC office ", OrgId: 1, Id: 1, Interval: "10s", Items: items}
			err = UpdatePlaylist(&query)
			require.NoError(t, err)
		})

		t.Run("Can remove playlist", func(t *testing.T) {
			query := models.DeletePlaylistCommand{Id: 1}
			err = DeletePlaylist(&query)
			require.NoError(t, err)
		})
	})
}
