package playlistimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/util"
)

type sqlStore struct {
	db db.DB
}

func (s *sqlStore) Insert(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	p := playlist.Playlist{}
	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		uid, err := generateAndValidateNewPlaylistUid(sess, cmd.OrgId)
		if err != nil {
			return err
		}

		p = playlist.Playlist{
			Name:     cmd.Name,
			Interval: cmd.Interval,
			OrgId:    cmd.OrgId,
			UID:      uid,
		}

		_, err = sess.Insert(&p)
		if err != nil {
			return err
		}

		playlistItems := make([]playlist.PlaylistItem, 0)
		for order, item := range cmd.Items {
			playlistItems = append(playlistItems, playlist.PlaylistItem{
				PlaylistId: p.Id,
				Type:       item.Type,
				Value:      item.Value,
				Order:      order + 1,
				Title:      item.Title,
			})
		}

		_, err = sess.Insert(&playlistItems)

		return err
	})
	return &p, err
}

func (s *sqlStore) Update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (*playlist.PlaylistDTO, error) {
	dto := playlist.PlaylistDTO{}
	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		p := playlist.Playlist{
			UID:      cmd.UID,
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Interval: cmd.Interval,
		}

		existingPlaylist := playlist.Playlist{UID: cmd.UID, OrgId: cmd.OrgId}
		_, err := sess.Get(&existingPlaylist)
		if err != nil {
			return err
		}
		p.Id = existingPlaylist.Id

		dto = playlist.PlaylistDTO{
			Uid:      p.UID,
			Name:     p.Name,
			Interval: p.Interval,
		}

		_, err = sess.Where("id=?", p.Id).Cols("name", "interval").Update(&p)
		if err != nil {
			return err
		}

		rawSQL := "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err = sess.Exec(rawSQL, p.Id)

		if err != nil {
			return err
		}

		playlistItems := make([]playlist.PlaylistItem, 0)

		for index, item := range cmd.Items {
			playlistItems = append(playlistItems, playlist.PlaylistItem{
				PlaylistId: p.Id,
				Type:       item.Type,
				Value:      item.Value,
				Order:      index + 1,
				Title:      item.Title,
			})
		}

		_, err = sess.Insert(&playlistItems)
		return err
	})
	return &dto, err
}

func (s *sqlStore) Get(ctx context.Context, query *playlist.GetPlaylistByUidQuery) (*playlist.Playlist, error) {
	if query.UID == "" || query.OrgId == 0 {
		return nil, playlist.ErrCommandValidationFailed
	}

	p := playlist.Playlist{}
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		p = playlist.Playlist{UID: query.UID, OrgId: query.OrgId}
		exists, err := sess.Get(&p)
		if !exists {
			return playlist.ErrPlaylistNotFound
		}

		return err
	})
	return &p, err
}

func (s *sqlStore) Delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	if cmd.UID == "" || cmd.OrgId == 0 {
		return playlist.ErrCommandValidationFailed
	}

	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		playlist := playlist.Playlist{UID: cmd.UID, OrgId: cmd.OrgId}
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

func (s *sqlStore) List(ctx context.Context, query *playlist.GetPlaylistsQuery) (playlist.Playlists, error) {
	playlists := make(playlist.Playlists, 0)
	if query.OrgId == 0 {
		return playlists, playlist.ErrCommandValidationFailed
	}

	err := s.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Limit(query.Limit)

		if query.Name != "" {
			sess.Where("name LIKE ?", "%"+query.Name+"%")
		}

		sess.Where("org_id = ?", query.OrgId)
		err := sess.Find(&playlists)

		return err
	})
	return playlists, err
}

func (s *sqlStore) GetItems(ctx context.Context, query *playlist.GetPlaylistItemsByUidQuery) ([]playlist.PlaylistItem, error) {
	var playlistItems = make([]playlist.PlaylistItem, 0)
	if query.PlaylistUID == "" || query.OrgId == 0 {
		return playlistItems, star.ErrCommandValidationFailed
	}
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		// getQuery the playlist Id
		getQuery := &playlist.GetPlaylistByUidQuery{UID: query.PlaylistUID, OrgId: query.OrgId}
		p, err := s.Get(ctx, getQuery)
		if err != nil {
			return err
		}

		err = sess.Where("playlist_id=?", p.Id).Find(&playlistItems)

		return err
	})
	return playlistItems, err
}

// generateAndValidateNewPlaylistUid generates a playlistUID and verifies that
// the uid isn't already in use. This is deliberately overly cautious, since users
// can also specify playlist uids during provisioning.
func generateAndValidateNewPlaylistUid(sess *db.Session, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := generateNewUid()

		playlist := playlist.Playlist{OrgId: orgId, UID: uid}
		exists, err := sess.Get(&playlist)
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", playlist.ErrPlaylistFailedGenerateUniqueUid
}

var generateNewUid func() string = util.GenerateShortUID
