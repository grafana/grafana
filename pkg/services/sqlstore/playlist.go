package sqlstore

import (
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
}

func CreatePlaylist(query *m.CreatePlaylistQuery) error {
	var err error

	playlist := m.Playlist{
		Title:    query.Title,
		Data:     query.Data,
		Timespan: query.Timespan,
	}

	_, err = x.Insert(&playlist)

	query.Result = &playlist
	return err
}

func UpdatePlaylist(query *m.UpdatePlaylistQuery) error {
	var err error
	x.Logger.SetLevel(5)
	playlist := m.Playlist{
		Id:       query.Id,
		Title:    query.Title,
		Data:     query.Data,
		Timespan: query.Timespan,
	}

	existingPlaylist := x.Where("id = ?", query.Id).Find(m.Playlist{})

	if existingPlaylist == nil {
		return m.ErrPlaylistNotFound
	}

	_, err = x.Id(query.Id).Cols("id", "title", "data", "timespan").Update(&playlist)

	query.Result = &playlist
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
		var rawSql = "DELETE FROM playlist WHERE id = ?"
		_, err := sess.Exec(rawSql, query.Id)
		return err
	})
}

func SearchPlaylists(query *m.PlaylistQuery) error {
	var playlists = make(m.Playlists, 0)

	sess := x.Limit(query.Limit)

	if query.Title != "" {
		sess.Where("title LIKE ?", query.Title)
	}

	err := sess.Find(&playlists)
	query.Result = playlists

	return err
}

func GetPlaylistDashboards(query *m.GetPlaylistDashboardsQuery) error {
	if query.Id == 0 {
		return m.ErrCommandValidationFailed
	}

	var dashboards = make(m.PlaylistDashboards, 0)
	var playlist = m.Playlist{}

	hasPlaylist, err := x.Id(query.Id).Get(&playlist)
	query.Result = &dashboards

	if err != nil {
		return err
	}

	if !hasPlaylist || len(playlist.Data) == 0 {
		return nil
	}

	err = x.In("id", playlist.Data).Find(&dashboards)

	if err != nil {
		return err
	}

	return nil
}
