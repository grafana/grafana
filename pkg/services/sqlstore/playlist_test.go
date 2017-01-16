package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
)

func TestPlaylistDataAccess(t *testing.T) {

	Convey("Testing Playlist data access", t, func() {
		InitTestDB(t)

		Convey("Can create playlist", func() {
			items := []m.PlaylistItemDTO{
				{Title: "graphite", Value: "graphite", Type: "dashboard_by_tag"},
				{Title: "Backend response times", Value: "3", Type: "dashboard_by_id"},
			}
			cmd := m.CreatePlaylistCommand{Name: "NYC office", Interval: "10m", OrgId: 1, Items: items}
			err := CreatePlaylist(&cmd)
			So(err, ShouldBeNil)

			Convey("can update playlist", func() {
				items := []m.PlaylistItemDTO{
					{Title: "influxdb", Value: "influxdb", Type: "dashboard_by_tag"},
					{Title: "Backend response times", Value: "2", Type: "dashboard_by_id"},
				}
				query := m.UpdatePlaylistCommand{Name: "NYC office ", OrgId: 1, Id: 1, Interval: "10s", Items: items}
				err = UpdatePlaylist(&query)

				So(err, ShouldBeNil)

				Convey("can remove playlist", func() {
					query := m.DeletePlaylistCommand{Id: 1}
					err = DeletePlaylist(&query)

					So(err, ShouldBeNil)
				})
			})
		})
	})
}
