package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func (ss *SQLStore) CreatePlaylist(ctx context.Context, cmd *models.CreatePlaylistCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		uid, err := generateAndValidateNewPlaylistUid(sess, cmd.OrgId)
		if err != nil {
			return errutil.Wrapf(err, "Failed to generate UID for playlist %q", cmd.Name)
		}

		playlist := models.Playlist{
			Name:     cmd.Name,
			Interval: cmd.Interval,
			OrgId:    cmd.OrgId,
			Uid:      uid,
		}

		_, err = sess.Insert(&playlist)
		if err != nil {
			return err
		}

		playlistItems := make([]models.PlaylistItem, 0)
		for _, item := range cmd.Items {
			playlistItems = append(playlistItems, models.PlaylistItem{
				PlaylistUid: playlist.Uid,
				Type:        item.Type,
				Value:       item.Value,
				Order:       item.Order,
				Title:       item.Title,
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
			Uid:      cmd.Uid,
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Interval: cmd.Interval,
		}

		existingPlaylist := sess.Where("id = ? AND org_id = ?", cmd.Uid, cmd.OrgId).Find(models.Playlist{})

		if existingPlaylist == nil {
			return models.ErrPlaylistNotFound
		}

		cmd.Result = &models.PlaylistDTO{
			Uid:      playlist.Uid,
			OrgId:    playlist.OrgId,
			Name:     playlist.Name,
			Interval: playlist.Interval,
		}

		_, err := sess.ID(cmd.Uid).Cols("name", "interval").Update(&playlist)

		if err != nil {
			return err
		}

		rawSQL := "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err = sess.Exec(rawSQL, cmd.Uid)

		if err != nil {
			return err
		}

		playlistItems := make([]models.PlaylistItem, 0)

		for index, item := range cmd.Items {
			playlistItems = append(playlistItems, models.PlaylistItem{
				PlaylistUid: playlist.Uid,
				Type:        item.Type,
				Value:       item.Value,
				Order:       index + 1,
				Title:       item.Title,
			})
		}

		_, err = sess.Insert(&playlistItems)

		return err
	})
}

func (ss *SQLStore) GetPlaylist(ctx context.Context, query *models.GetPlaylistByUidQuery) error {
	if query.Uid == "" {
		return models.ErrCommandValidationFailed
	}

	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		playlist := models.Playlist{}
		_, err := sess.ID(query.Uid).Get(&playlist)

		query.Result = &playlist

		return err
	})
}

func (ss *SQLStore) DeletePlaylist(ctx context.Context, cmd *models.DeletePlaylistCommand) error {
	if cmd.Uid == "" || cmd.OrgId == 0 {
		return models.ErrCommandValidationFailed
	}

	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var rawPlaylistSQL = "DELETE FROM playlist WHERE id = ? and org_id = ?"
		_, err := sess.Exec(rawPlaylistSQL, cmd.Uid, cmd.OrgId)

		if err != nil {
			return err
		}

		var rawItemSQL = "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err2 := sess.Exec(rawItemSQL, cmd.Uid)

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

func (ss *SQLStore) GetPlaylistItem(ctx context.Context, query *models.GetPlaylistItemsByUidQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		if query.PlaylistUid == "" {
			return models.ErrCommandValidationFailed
		}

		var playlistItems = make([]models.PlaylistItem, 0)
		err := sess.Where("playlist_id=?", query.PlaylistUid).Find(&playlistItems)

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

		exists, err := sess.Where(uid).Get(&models.Playlist{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrDataSourceFailedGenerateUniqueUid
}
