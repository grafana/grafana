package playlistimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type store interface {
	search(ctx context.Context, query *playlist.GetPlaylistsQuery) (playlist.SearchPlaylistsResult, error)
	getById(ctx context.Context, query *playlist.GetPlaylistByIdQuery) (playlist.GetPlaylistResult, error)
	getItemsById(ctx context.Context, query *playlist.GetPlaylistItemsByIdQuery) (playlist.GetPlaylistItemsResult, error)
	delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error
	create(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (playlist.CreatePlaylistResult, error)
	update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (playlist.UpdatePlaylistResult, error)
}

func newPlaylistStore(sqlstore sqlstore.Store) *storeImpl {
	s := &storeImpl{dbSession: sqlstore}
	return s
}

type storeImpl struct {
	dbSession db.DB
}

func (s *storeImpl) search(ctx context.Context, query *playlist.GetPlaylistsQuery) (playlist.SearchPlaylistsResult, error) {
	var playlists = playlist.SearchPlaylistsResult{Playlists: make(playlist.Playlists, 0)}
	err := s.dbSession.WithDbSession(ctx, func(dbSess *sqlstore.DBSession) error {
		sess := dbSess.Limit(query.Limit)
		if query.Name != "" {
			sess.Where("name LIKE ?", "%"+query.Name+"%")
		}
		sess.Where("org_id = ?", query.OrgId)
		err := sess.Find(&playlists.Playlists)
		return err
	})
	return playlists, err
}

func (s *storeImpl) getById(ctx context.Context, query *playlist.GetPlaylistByIdQuery) (playlist.GetPlaylistResult, error) {
	playlist := playlist.Playlist{}
	err := s.dbSession.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.ID(query.Id).Get(&playlist)
		return err
	})
	return &playlist, err
}

func (s *storeImpl) getItemsById(ctx context.Context, query *playlist.GetPlaylistItemsByIdQuery) (playlist.GetPlaylistItemsResult, error) {
	var playlistItems = make([]playlist.PlaylistItem, 0)
	err := s.dbSession.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if query.PlaylistId == 0 {
			return models.ErrCommandValidationFailed
		}
		err := sess.Where("playlist_id=?", query.PlaylistId).Find(&playlistItems)
		return err
	})
	return playlist.GetPlaylistItemsResult{Items: &playlistItems}, err
}

func (s *storeImpl) delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	return s.dbSession.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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

func (s *storeImpl) create(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (playlist.CreatePlaylistResult, error) {
	result := &playlist.Playlist{
		Name:     cmd.Name,
		Interval: cmd.Interval,
		OrgId:    cmd.OrgId,
	}
	err := s.dbSession.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Insert(result)
		if err != nil {
			return err
		}

		playlistItems := make([]playlist.PlaylistItem, 0)
		for _, item := range cmd.Items {
			playlistItems = append(playlistItems, playlist.PlaylistItem{
				PlaylistId: result.Id,
				Type:       item.Type,
				Value:      item.Value,
				Order:      item.Order,
				Title:      item.Title,
			})
		}

		_, err = sess.Insert(&playlistItems)

		return err
	})
	return result, err
}

func (s *storeImpl) update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (playlist.UpdatePlaylistResult, error) {
	result := &playlist.PlaylistDTO{
		Id:       cmd.Id,
		OrgId:    cmd.OrgId,
		Name:     cmd.Name,
		Interval: cmd.Interval,
	}

	err := s.dbSession.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		playlistObj := playlist.Playlist{
			Id:       cmd.Id,
			OrgId:    cmd.OrgId,
			Name:     cmd.Name,
			Interval: cmd.Interval,
		}

		existingPlaylist := sess.Where("id = ? AND org_id = ?", cmd.Id, cmd.OrgId).Find(playlist.Playlist{})

		if existingPlaylist == nil {
			return playlist.ErrPlaylistNotFound
		}

		_, err := sess.ID(cmd.Id).Cols("name", "interval").Update(&playlistObj)

		if err != nil {
			return err
		}

		rawSQL := "DELETE FROM playlist_item WHERE playlist_id = ?"
		_, err = sess.Exec(rawSQL, cmd.Id)

		if err != nil {
			return err
		}

		playlistItems := make([]playlist.PlaylistItem, 0)

		for index, item := range cmd.Items {
			playlistItems = append(playlistItems, playlist.PlaylistItem{
				PlaylistId: playlistObj.Id,
				Type:       item.Type,
				Value:      item.Value,
				Order:      index + 1,
				Title:      item.Title,
			})
		}

		_, err = sess.Insert(&playlistItems)
		return err
	})
	return result, err
}
