package playlistimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/util"
)

type sqlStore struct {
	db db.DB
}

const MAX_PLAYLISTS = 1000

var _ store = &sqlStore{}

func (s *sqlStore) Insert(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	p := playlist.Playlist{}
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	} else {
		err := util.ValidateUID(cmd.UID)
		if err != nil {
			return nil, err
		}
	}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		count, err := sess.SQL("SELECT COUNT(*) FROM playlist WHERE playlist.org_id = ?", cmd.OrgId).Count()
		if err != nil {
			return err
		}
		if count > MAX_PLAYLISTS {
			return fmt.Errorf("too many playlists exist (%d > %d)", count, MAX_PLAYLISTS)
		}

		ts := time.Now().UnixMilli()
		p = playlist.Playlist{
			Name:      cmd.Name,
			Interval:  cmd.Interval,
			OrgId:     cmd.OrgId,
			UID:       cmd.UID,
			CreatedAt: ts,
			UpdatedAt: ts,
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
		p.CreatedAt = existingPlaylist.CreatedAt
		p.UpdatedAt = time.Now().UnixMilli()

		dto = playlist.PlaylistDTO{
			Uid:      p.UID,
			Name:     p.Name,
			Interval: p.Interval,
		}

		_, err = sess.Where("id=?", p.Id).Cols("name", "interval", "updated_at").Update(&p)
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

	if query.Limit > MAX_PLAYLISTS || query.Limit < 1 {
		query.Limit = MAX_PLAYLISTS
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

func (s *sqlStore) ListAll(ctx context.Context, orgId int64) ([]playlist.PlaylistDTO, error) {
	db := s.db.GetSqlxSession() // OK because dates are numbers!

	playlists := []playlist.PlaylistDTO{}
	err := db.Select(ctx, &playlists, "SELECT * FROM playlist WHERE org_id=? ORDER BY created_at asc LIMIT ?", orgId, MAX_PLAYLISTS)
	if err != nil {
		return nil, err
	}

	// Create a map that links playlist id to the playlist array index
	lookup := map[int64]int{}
	for i, v := range playlists {
		lookup[v.Id] = i
	}

	var playlistId int64
	var itemType string
	var itemValue string

	rows, err := db.Query(ctx, `SELECT playlist.id,playlist_item.type,playlist_item.value
		FROM playlist_item 
		JOIN playlist ON playlist_item.playlist_id = playlist.id
		WHERE playlist.org_id = ?
		ORDER BY playlist_id asc, `+s.db.Quote("order")+` asc`, orgId)
	if err != nil {
		return nil, err
	}

	defer func() {
		_ = rows.Close()
	}()

	for rows.Next() {
		err = rows.Scan(&playlistId, &itemType, &itemValue)
		if err != nil {
			return nil, err
		}
		idx, ok := lookup[playlistId]
		if !ok {
			return nil, fmt.Errorf("could not find playlist by id")
		}
		items := append(playlists[idx].Items, playlist.PlaylistItemDTO{
			Type:  itemType,
			Value: itemValue,
		})
		playlists[idx].Items = items
	}
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
