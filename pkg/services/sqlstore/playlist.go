package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) CreatePlaylist(ctx context.Context, cmd *models.CreatePlaylistCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		uid, err := generateAndValidateNewPlaylistUid(sess, cmd.OrgId)
		if err != nil {
			return err
		}

		playlist := models.Playlist{
			Name:     cmd.Name,
			Interval: cmd.Interval,
			OrgId:    cmd.OrgId,
			UID:      uid,
		}

		_, err = sess.Insert(&playlist)
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
			UID:      cmd.UID,
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Interval: cmd.Interval,
		}

		existingPlaylist := models.Playlist{UID: cmd.UID, OrgId: cmd.OrgId}
		_, err := sess.Get(&existingPlaylist)
		if err != nil {
			return err
		}
		playlist.Id = existingPlaylist.Id

		cmd.Result = &models.PlaylistDTO{
			Id:       playlist.Id,
			UID:      playlist.UID,
			OrgId:    playlist.OrgId,
			Name:     playlist.Name,
			Interval: playlist.Interval,
		}

		_, err = sess.Where("id=?", playlist.Id).Cols("name", "interval").Update(&playlist)
		if err != nil {
			return err
		}

		rawSQL := "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err = sess.Exec(rawSQL, playlist.Id)

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

func (ss *SQLStore) GetPlaylist(ctx context.Context, query *models.GetPlaylistByUidQuery) error {
	if query.UID == "" || query.OrgId == 0 {
		return models.ErrCommandValidationFailed
	}

	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		playlist := models.Playlist{UID: query.UID, OrgId: query.OrgId}
		exists, err := sess.Get(&playlist)
		if !exists {
			return models.ErrPlaylistNotFound
		}
		query.Result = &playlist

		return err
	})
}

func (ss *SQLStore) DeletePlaylist(ctx context.Context, cmd *models.DeletePlaylistCommand) error {
	if cmd.UID == "" || cmd.OrgId == 0 {
		return models.ErrCommandValidationFailed
	}

	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		playlist := models.Playlist{UID: cmd.UID, OrgId: cmd.OrgId}
		_, err := sess.Get(&playlist)
		if err != nil {
			return err
		}

		var rawPlaylistSQL = "DELETE FROM playlist WHERE uid = ? and org_id = ?"
		_, err = sess.Exec(rawPlaylistSQL, cmd.UID, cmd.OrgId)
		if err != nil {
			return err
		}

		var rawItemSQL = "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err = sess.Exec(rawItemSQL, playlist.Id)

		return err
	})
}

func (ss *SQLStore) SearchPlaylists(ctx context.Context, query *models.GetPlaylistsQuery) error {
	if query.OrgId == 0 {
		return models.ErrCommandValidationFailed
	}

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

func (ss *SQLStore) GetPlaylistItem(ctx context.Context, query *models.GetPlaylistItemsByUidQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		if query.PlaylistUID == "" || query.OrgId == 0 {
			return models.ErrCommandValidationFailed
		}

		// get the playlist Id
		get := &models.GetPlaylistByUidQuery{UID: query.PlaylistUID, OrgId: query.OrgId}
		err := ss.GetPlaylist(ctx, get)
		if err != nil {
			return err
		}

		var playlistItems = make([]models.PlaylistItem, 0)
		err = sess.Where("playlist_id=?", get.Result.Id).Find(&playlistItems)
		query.Result = &playlistItems

		return err
	})
}

// generateAndValidateNewPlaylistUid generates a playlistUID and verifies that
// the uid isn't already in use. This is deliberately overly cautious, since users
// can also specify playlist uids during provisioning.
func generateAndValidateNewPlaylistUid(sess *DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := generateNewUid()

		playlist := models.Playlist{OrgId: orgId, UID: uid}
		exists, err := sess.Get(&playlist)
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrPlaylistFailedGenerateUniqueUid
}
