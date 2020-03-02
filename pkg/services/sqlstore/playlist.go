package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", CreatePlaylist)
	bus.AddHandler("sql", UpdatePlaylist)
	bus.AddHandler("sql", DeletePlaylist)
	bus.AddHandler("sql", SearchPlaylists)
	bus.AddHandler("sql", GetPlaylist)
	bus.AddHandler("sql", GetPlaylistItem)
}

func CreatePlaylist(cmd *models.CreatePlaylistCommand) error {
	playlist := models.Playlist{
		Name:     cmd.Name,
		Interval: cmd.Interval,
		OrgId:    cmd.OrgId,
	}

	_, err := x.Insert(&playlist)
	if err != nil {
		return err
	}

	playlistItems := make([]models.PlaylistItem, 0)
	for _, item := range cmd.Items {
		playlistItems = append(playlistItems, models.PlaylistItem{
			PlaylistId: playlist.Id,
			Type:       item.Type,
			Value:      item.Value,
			Order:      item.Order,
			Title:      item.Title,
		})
	}

	_, err = x.Insert(&playlistItems)

	cmd.Result = &playlist
	return err
}

func UpdatePlaylist(cmd *models.UpdatePlaylistCommand) error {
	playlist := models.Playlist{
		Id:       cmd.Id,
		OrgId:    cmd.OrgId,
		Name:     cmd.Name,
		Interval: cmd.Interval,
	}

	existingPlaylist := x.Where("id = ? AND org_id = ?", cmd.Id, cmd.OrgId).Find(models.Playlist{})

	if existingPlaylist == nil {
		return models.ErrPlaylistNotFound
	}

	cmd.Result = &models.PlaylistDTO{
		Id:       playlist.Id,
		OrgId:    playlist.OrgId,
		Name:     playlist.Name,
		Interval: playlist.Interval,
	}

	_, err := x.ID(cmd.Id).Cols("name", "interval").Update(&playlist)

	if err != nil {
		return err
	}

	rawSql := "DELETE FROM playlist_item WHERE playlist_id = ?"
	_, err = x.Exec(rawSql, cmd.Id)

	if err != nil {
		return err
	}

	playlistItems := make([]models.PlaylistItem, 0)

	for index, item := range cmd.Items {
		playlistItems = append(playlistItems, models.PlaylistItem{
			PlaylistId: playlist.Id,
			Type:       item.Type,
			Value:      item.Value,
			Order:      index + 1,
			Title:      item.Title,
		})
	}

	_, err = x.Insert(&playlistItems)

	return err
}

func GetPlaylist(query *models.GetPlaylistByIdQuery) error {
	if query.Id == 0 {
		return models.ErrCommandValidationFailed
	}

	playlist := models.Playlist{}
	_, err := x.ID(query.Id).Get(&playlist)

	query.Result = &playlist

	return err
}

func DeletePlaylist(cmd *models.DeletePlaylistCommand) error {
	if cmd.Id == 0 {
		return models.ErrCommandValidationFailed
	}

	return inTransaction(func(sess *DBSession) error {
		var rawPlaylistSql = "DELETE FROM playlist WHERE id = ? and org_id = ?"
		_, err := sess.Exec(rawPlaylistSql, cmd.Id, cmd.OrgId)

		if err != nil {
			return err
		}

		var rawItemSql = "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err2 := sess.Exec(rawItemSql, cmd.Id)

		return err2
	})
}

func SearchPlaylists(query *models.GetPlaylistsQuery) error {
	var playlists = make(models.Playlists, 0)

	sess := x.Limit(query.Limit)

	if query.Name != "" {
		sess.Where("name LIKE ?", query.Name)
	}

	sess.Where("org_id = ?", query.OrgId)
	err := sess.Find(&playlists)
	query.Result = playlists

	return err
}

func GetPlaylistItem(query *models.GetPlaylistItemsByIdQuery) error {
	if query.PlaylistId == 0 {
		return models.ErrCommandValidationFailed
	}

	var playlistItems = make([]models.PlaylistItem, 0)
	err := x.Where("playlist_id=?", query.PlaylistId).Find(&playlistItems)

	query.Result = &playlistItems

	return err
}
