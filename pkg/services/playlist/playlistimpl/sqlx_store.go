package playlistimpl

import (
	"context"
	"database/sql"
	"errors"

	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/star"
)

type sqlxStore struct {
	sess *session.SessionDB
}

func (s *sqlxStore) Insert(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	p := playlist.Playlist{}
	var err error
	uid, err := newGenerateAndValidateNewPlaylistUid(ctx, s.sess, cmd.OrgId)
	if err != nil {
		return nil, err
	}

	p = playlist.Playlist{
		Name:     cmd.Name,
		Interval: cmd.Interval,
		OrgId:    cmd.OrgId,
		UID:      uid,
	}

	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		query := `INSERT INTO playlist (name, "interval", org_id, uid) VALUES (?, ?, ?, ?)`
		var err error
		p.Id, err = tx.ExecWithReturningId(ctx, query, p.Name, p.Interval, p.OrgId, p.UID)
		if err != nil {
			return err
		}

		if len(cmd.Items) > 0 {
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
			query := `INSERT INTO playlist_item (playlist_id, type, value, title, "order") VALUES (:playlist_id, :type, :value, :title, :order)`
			_, err = tx.NamedExec(ctx, query, playlistItems)
			if err != nil {
				return err
			}
		}
		return nil
	})

	return &p, err
}

func (s *sqlxStore) Update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (*playlist.PlaylistDTO, error) {
	dto := playlist.PlaylistDTO{}

	// Get the id of playlist to be updated with orgId and UID
	existingPlaylist, err := s.Get(ctx, &playlist.GetPlaylistByUidQuery{UID: cmd.UID, OrgId: cmd.OrgId})
	if err != nil {
		return nil, err
	}

	// Create object to be update to
	p := playlist.Playlist{
		Id:       existingPlaylist.Id,
		UID:      cmd.UID,
		OrgId:    cmd.OrgId,
		Name:     cmd.Name,
		Interval: cmd.Interval,
	}

	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		query := `UPDATE playlist SET uid=:uid, org_id=:org_id, name=:name, "interval"=:interval WHERE id=:id`
		_, err = tx.NamedExec(ctx, query, p)
		if err != nil {
			return err
		}

		if _, err = tx.Exec(ctx, "DELETE FROM playlist_item WHERE playlist_id = ?", p.Id); err != nil {
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
		query = `INSERT INTO playlist_item (playlist_id, type, value, title, "order") VALUES (:playlist_id, :type, :value, :title, :order)`
		_, err = tx.NamedExec(ctx, query, playlistItems)
		return err
	})

	return &dto, err
}

func (s *sqlxStore) Get(ctx context.Context, query *playlist.GetPlaylistByUidQuery) (*playlist.Playlist, error) {
	if query.UID == "" || query.OrgId == 0 {
		return nil, playlist.ErrCommandValidationFailed
	}

	p := playlist.Playlist{}
	err := s.sess.Get(ctx, &p, "SELECT * FROM playlist WHERE uid=? AND org_id=?", query.UID, query.OrgId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, playlist.ErrPlaylistNotFound
		}
		return nil, err
	}
	return &p, err
}

func (s *sqlxStore) Delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	if cmd.UID == "" || cmd.OrgId == 0 {
		return playlist.ErrCommandValidationFailed
	}

	p := playlist.Playlist{}
	if err := s.sess.Get(ctx, &p, "SELECT * FROM playlist WHERE uid=? AND org_id=?", cmd.UID, cmd.OrgId); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	err := s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		if _, err := tx.Exec(ctx, "DELETE FROM playlist WHERE uid = ? and org_id = ?", cmd.UID, cmd.OrgId); err != nil {
			return err
		}

		if _, err := tx.Exec(ctx, "DELETE FROM playlist_item WHERE playlist_id = ?", p.Id); err != nil {
			return err
		}
		return nil
	})

	return err
}

func (s *sqlxStore) List(ctx context.Context, query *playlist.GetPlaylistsQuery) (playlist.Playlists, error) {
	playlists := make(playlist.Playlists, 0)
	if query.OrgId == 0 {
		return playlists, playlist.ErrCommandValidationFailed
	}

	var err error
	if query.Name == "" {
		err = s.sess.Select(
			ctx, &playlists, "SELECT * FROM playlist WHERE org_id = ? LIMIT ?", query.OrgId, query.Limit)
	} else {
		err = s.sess.Select(
			ctx, &playlists, "SELECT * FROM playlist WHERE org_id = ? AND name LIKE ? LIMIT ?", query.OrgId, "%"+query.Name+"%", query.Limit)
	}
	return playlists, err
}

func (s *sqlxStore) GetItems(ctx context.Context, query *playlist.GetPlaylistItemsByUidQuery) ([]playlist.PlaylistItem, error) {
	var playlistItems = make([]playlist.PlaylistItem, 0)
	if query.PlaylistUID == "" || query.OrgId == 0 {
		return playlistItems, star.ErrCommandValidationFailed
	}

	var p = playlist.Playlist{}
	err := s.sess.Get(ctx, &p, "SELECT * FROM playlist WHERE uid=? AND org_id=?", query.PlaylistUID, query.OrgId)
	if err != nil {
		return playlistItems, err
	}

	err = s.sess.Select(ctx, &playlistItems, "SELECT * FROM playlist_item WHERE playlist_id=?", p.Id)
	return playlistItems, err
}

func newGenerateAndValidateNewPlaylistUid(ctx context.Context, sess *session.SessionDB, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := generateNewUid()
		p := playlist.Playlist{OrgId: orgId, UID: uid}
		err := sess.Get(ctx, &p, "SELECT * FROM playlist WHERE uid=? AND org_id=?", uid, orgId)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return uid, nil
			}
			return "", err
		}
	}

	return "", playlist.ErrPlaylistFailedGenerateUniqueUid
}
