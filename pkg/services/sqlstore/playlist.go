package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) addPlaylistQueryAndCommandHandlers() {
	bus.AddHandlerCtx("sql", ss.CreatePlaylist)
	bus.AddHandlerCtx("sql", ss.UpdatePlaylist)
	bus.AddHandlerCtx("sql", ss.DeletePlaylist)
	bus.AddHandlerCtx("sql", ss.SearchPlaylists)
	bus.AddHandlerCtx("sql", ss.GetPlaylist)
	bus.AddHandlerCtx("sql", ss.GetPlaylistItem)
}

func (ss *SQLStore) CreatePlaylist(ctx context.Context, cmd *models.CreatePlaylistCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		playlist := models.Playlist{
			Name:     cmd.Name,
			Interval: cmd.Interval,
			OrgId:    cmd.OrgId,
		}

		_, err := sess.Insert(&playlist)
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

		_, err = sess.Insert(&playlistItems)

		cmd.Result = &playlist
		return err
	})
}

func (ss *SQLStore) UpdatePlaylist(ctx context.Context, cmd *models.UpdatePlaylistCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		playlist := models.Playlist{
			Id:       cmd.Id,
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Interval: cmd.Interval,
		}

		existingPlaylist := sess.Where("id = ? AND org_id = ?", cmd.Id, cmd.OrgId).Find(models.Playlist{})

		if existingPlaylist == nil {
			return models.ErrPlaylistNotFound
		}

		cmd.Result = &models.PlaylistDTO{
			Id:       playlist.Id,
			OrgId:    playlist.OrgId,
			Name:     playlist.Name,
			Interval: playlist.Interval,
		}

		_, err := sess.ID(cmd.Id).Cols("name", "interval").Update(&playlist)

		if err != nil {
			return err
		}

		rawSQL := "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err = sess.Exec(rawSQL, cmd.Id)

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

		_, err = sess.Insert(&playlistItems)

		return err
	})
}

func (ss *SQLStore) GetPlaylist(ctx context.Context, query *models.GetPlaylistByIdQuery) error {
	if query.Id == 0 {
		return models.ErrCommandValidationFailed
	}
	
	return ss.WithDbSession(ctx, func(sess *DBSession) error {

		playlist := models.Playlist{}
		_, err := sess.ID(query.Id).Get(&playlist)

		query.Result = &playlist

		return err
	})
}

func (ss *SQLStore) DeletePlaylist(ctx context.Context, cmd *models.DeletePlaylistCommand) error {
	if cmd.Id == 0 || cmd.OrgId == 0 {
		return models.ErrCommandValidationFailed
	}

	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var rawPlaylistSQL = "DELETE FROM playlist WHERE id = ? and org_id = ?"
		_, err := sess.Exec(rawPlaylistSQL, cmd.Id, cmd.OrgId)

		if err != nil {
			return err
		}

		var rawItemSQL = "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err2 := sess.Exec(rawItemSQL, cmd.Id)

		return err2
	})
}

func (ss *SQLStore) SearchPlaylists(ctx context.Context, query *models.GetPlaylistsQuery) error {
	return ss.WithDbSession(ctx, func(dbSess *DBSession) error {
		var playlists = make(models.Playlists, 0)

		sess := dbSess.Limit(query.Limit)

		if query.Name != "" {
			sess.Where("name LIKE ?", "%"+query.Name+"%")
		}

		sess.Where("org_id = ?", query.OrgId)
		err := sess.Find(&playlists)
		query.Result = playlists

		return err
	})
}

func (ss *SQLStore) GetPlaylistItem(ctx context.Context, query *models.GetPlaylistItemsByIdQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		if query.PlaylistId == 0 {
			return models.ErrCommandValidationFailed
		}

		var playlistItems = make([]models.PlaylistItem, 0)
		err := sess.Where("playlist_id=?", query.PlaylistId).Find(&playlistItems)

		query.Result = &playlistItems

		return err
	})
}
