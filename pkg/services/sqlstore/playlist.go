package sqlstore

import (
	"fmt"
	"github.com/go-xorm/xorm"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreatePlaylist)
	bus.AddHandler("sql", UpdatePlaylist)
	bus.AddHandler("sql", DeletePlaylist)
	bus.AddHandler("sql", SearchPlaylists)
	bus.AddHandler("sql", GetPlaylist)
	bus.AddHandler("sql", GetPlaylistDashboards)
	bus.AddHandler("sql", GetPlaylistItem)
}

func CreatePlaylist(query *m.CreatePlaylistQuery) error {
	var err error

	playlist := m.Playlist{
		Title:    query.Title,
		Interval: query.Interval,
		OrgId:    query.OrgId,
	}

	_, err = x.Insert(&playlist)

	fmt.Printf("%v", playlist.Id)

	playlistItems := make([]m.PlaylistItem, 0)
	for _, item := range query.Items {
		playlistItems = append(playlistItems, m.PlaylistItem{
			PlaylistId: playlist.Id,
			Type:       item.Type,
			Value:      item.Value,
			Order:      item.Order,
			Title:      item.Title,
		})
	}

	_, err = x.Insert(&playlistItems)

	query.Result = &playlist
	return err
}

func UpdatePlaylist(query *m.UpdatePlaylistQuery) error {
	var err error
	x.Logger.SetLevel(5)
	playlist := m.Playlist{
		Id:       query.Id,
		Title:    query.Title,
		Interval: query.Interval,
	}

	existingPlaylist := x.Where("id = ?", query.Id).Find(m.Playlist{})

	if existingPlaylist == nil {
		return m.ErrPlaylistNotFound
	}

	query.Result = &m.PlaylistDTO{
		Id:       playlist.Id,
		OrgId:    playlist.OrgId,
		Title:    playlist.Title,
		Interval: playlist.Interval,
	}

	_, err = x.Id(query.Id).Cols("id", "title", "timespan").Update(&playlist)

	if err != nil {
		return err
	}

	rawSql := "DELETE FROM playlist_item WHERE playlist_id = ?"
	_, err = x.Exec(rawSql, query.Id)

	if err != nil {
		return err
	}

	playlistItems := make([]m.PlaylistItem, 0)

	for _, item := range query.Items {
		playlistItems = append(playlistItems, m.PlaylistItem{
			PlaylistId: playlist.Id,
			Type:       item.Type,
			Value:      item.Value,
			Order:      item.Order,
			Title:      item.Title,
		})
	}

	_, err = x.Insert(&playlistItems)

	return err
}

func GetPlaylist(query *m.GetPlaylistByIdQuery) error {
	if query.Id == 0 {
		return m.ErrCommandValidationFailed
	}

	playlist := m.Playlist{}
	_, err := x.Id(query.Id).Get(&playlist)

	query.Result = &playlist

	return err
}

func DeletePlaylist(query *m.DeletePlaylistQuery) error {
	if query.Id == 0 {
		return m.ErrCommandValidationFailed
	}

	return inTransaction(func(sess *xorm.Session) error {
		var rawPlaylistSql = "DELETE FROM playlist WHERE id = ?"
		_, err := sess.Exec(rawPlaylistSql, query.Id)

		if err != nil {
			return err
		}

		var rawItemSql = "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err2 := sess.Exec(rawItemSql, query.Id)

		return err2
	})
}

func SearchPlaylists(query *m.PlaylistQuery) error {
	var playlists = make(m.Playlists, 0)

	sess := x.Limit(query.Limit)

	if query.Title != "" {
		sess.Where("title LIKE ?", query.Title)
	}

	sess.Where("org_id = ?", query.OrgId)
	err := sess.Find(&playlists)
	query.Result = playlists

	return err
}

func GetPlaylistItem(query *m.GetPlaylistItemsByIdQuery) error {
	if query.PlaylistId == 0 {
		return m.ErrCommandValidationFailed
	}

	var playlistItems = make([]m.PlaylistItem, 0)
	err := x.Where("playlist_id=?", query.PlaylistId).Find(&playlistItems)

	query.Result = &playlistItems

	return err
}

func GetPlaylistDashboards(query *m.GetPlaylistDashboardsQuery) error {
	if len(query.DashboardIds) == 0 {
		return m.ErrCommandValidationFailed
	}

	var dashboards = make(m.PlaylistDashboards, 0)

	err := x.In("id", query.DashboardIds).Find(&dashboards)
	query.Result = &dashboards

	if err != nil {
		return err
	}

	return nil
}
