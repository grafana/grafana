package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", CreatePlaylist)
	bus.AddHandler("sql", UpdatePlaylist)
	bus.AddHandler("sql", UpdatePlaylistByUid)
	bus.AddHandler("sql", DeletePlaylist)
	bus.AddHandler("sql", DeletePlaylistByUid)
	bus.AddHandler("sql", SearchPlaylists)
	bus.AddHandler("sql", GetPlaylist)
	bus.AddHandler("sql", GetPlaylistByUid)
	bus.AddHandler("sql", GetPlaylistItems)
}

func generateNewPlaylistUid(sess *DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()
		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&m.Playlist{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", m.ErrPlaylistFailedGenerateUniqueUid
}

func CreatePlaylist(cmd *m.CreatePlaylistCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if cmd.Uid == "" {
			uid, uidGenerationErr := generateNewPlaylistUid(sess, cmd.OrgId)
			if uidGenerationErr != nil {
				return uidGenerationErr
			}

			cmd.Uid = uid
		}

		playlist := m.Playlist{
			Uid:      cmd.Uid,
			Name:     cmd.Name,
			Interval: cmd.Interval,
			OrgId:    cmd.OrgId,
		}

		_, err := sess.Insert(&playlist)
		if err != nil {
			return err
		}

		playlistItems := make([]m.PlaylistItem, 0)
		for _, item := range cmd.Items {
			playlistItems = append(playlistItems, m.PlaylistItem{
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

func UpdatePlaylist(cmd *m.UpdatePlaylistCommand) error {
	return inTransaction(func(sess *DBSession) error {
		exists, err := sess.Where("id = ? AND org_id = ?", cmd.Id, cmd.OrgId).Get(&m.Playlist{})

		if err != nil {
			return err
		}

		if !exists {
			return m.ErrPlaylistNotFound
		}

		cmd.Result = &m.PlaylistDTO{
			Id:       cmd.Id,
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Interval: cmd.Interval,
		}

		return updatePlaylistInternal(cmd.Id, cmd.OrgId, cmd.Name, cmd.Interval, cmd.Items, sess)
	})
}

func UpdatePlaylistByUid(cmd *m.UpdatePlaylistWithUidCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var existing m.Playlist
		exists, err := sess.Where("uid = ? AND org_id = ?", cmd.Uid, cmd.OrgId).Get(&existing)

		if err != nil {
			return err
		}

		if !exists {
			return m.ErrPlaylistNotFound
		}

		id := existing.Id

		cmd.Result = &m.PlaylistDTO{
			Id:       id,
			Uid:      cmd.Uid,
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Interval: cmd.Interval,
		}

		return updatePlaylistInternal(id, cmd.OrgId, cmd.Name, cmd.Interval, cmd.Items, sess)
	})
}

func updatePlaylistInternal(id int64, orgId int64, name string, interval string, items []m.PlaylistItemDTO, sess *DBSession) error {
	_, err := sess.Cols("name", "interval").Update(&m.Playlist{Name: name, Interval: interval}, &m.Playlist{Id: id, OrgId: orgId})
	if err != nil {
		return err
	}

	deleteItemsRawSql := "DELETE FROM playlist_item WHERE playlist_id = ?"
	_, err = sess.Exec(deleteItemsRawSql, id)
	if err != nil {
		return err
	}

	playlistItems := make([]m.PlaylistItem, 0)

	for index, item := range items {
		playlistItems = append(playlistItems, m.PlaylistItem{
			PlaylistId: id,
			Type:       item.Type,
			Value:      item.Value,
			Order:      index + 1,
			Title:      item.Title,
		})
	}

	_, err = sess.Insert(&playlistItems)

	return err
}

func GetPlaylist(query *m.GetPlaylistByIdQuery) error {
	if query.Id == 0 {
		return m.ErrCommandValidationFailed
	}

	playlist := m.Playlist{}
	exists, err := x.ID(query.Id).Get(&playlist)

	if exists {
		query.Result = &playlist
	}

	return err
}

func GetPlaylistByUid(query *m.GetPlaylistByUidQuery) error {
	if query.OrgId == 0 || query.Uid == "" {
		return m.ErrCommandValidationFailed
	}

	playlist := m.Playlist{
		OrgId: query.OrgId,
		Uid:   query.Uid,
	}
	exists, err := x.Get(&playlist)

	if exists {
		query.Result = &playlist
	}

	return err
}

func DeletePlaylist(cmd *m.DeletePlaylistCommand) error {
	if cmd.OrgId == 0 || cmd.Id == 0 {
		return m.ErrCommandValidationFailed
	}

	return inTransaction(func(sess *DBSession) error {
		return deletePlaylistInternal(cmd.Id, cmd.OrgId, sess)
	})
}

func DeletePlaylistByUid(cmd *m.DeletePlaylistWithUidCommand) error {
	if cmd.OrgId == 0 || cmd.Uid == "" {
		return m.ErrCommandValidationFailed
	}

	return inTransaction(func(sess *DBSession) error {
		var existing m.Playlist
		exists, err := sess.Where("uid = ? AND org_id = ?", cmd.Uid, cmd.OrgId).Get(&existing)

		if err != nil {
			return err
		}

		if !exists {
			return m.ErrPlaylistNotFound
		}

		id := existing.Id

		return deletePlaylistInternal(id, cmd.OrgId, sess)
	})
}

func deletePlaylistInternal(id int64, orgId int64, sess *DBSession) error {
	var rawPlaylistSql = "DELETE FROM playlist WHERE id = ? and org_id = ?"
	_, err := sess.Exec(rawPlaylistSql, id, orgId)

	if err != nil {
		return err
	}

	var rawItemSql = "DELETE FROM playlist_item WHERE playlist_id = ?"
	_, err = sess.Exec(rawItemSql, id)

	return err
}

func SearchPlaylists(query *m.GetPlaylistsQuery) error {
	var playlists = make(m.Playlists, 0)

	sess := x.Limit(query.Limit)

	if query.Name != "" {
		sess.Where("name LIKE ?", query.Name)
	}

	sess.Where("org_id = ?", query.OrgId)
	err := sess.Find(&playlists)
	query.Result = playlists

	return err
}

func GetPlaylistItems(query *m.GetPlaylistItemsByIdQuery) error {
	if query.PlaylistId == 0 {
		return m.ErrCommandValidationFailed
	}

	var playlistItems = make([]m.PlaylistItem, 0)
	err := x.Where("playlist_id=?", query.PlaylistId).Find(&playlistItems)

	query.Result = &playlistItems

	return err
}
