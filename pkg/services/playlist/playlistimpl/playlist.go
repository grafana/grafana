package playlistimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
}

func ProvideService(db db.DB, cfg *setting.Cfg) playlist.Service {
	if cfg.IsFeatureToggleEnabled("newDBLibrary") {
		return &Service{
			store: &sqlxStore{
				sess: db.GetSqlxSession(),
			},
		}
	}
	return &Service{
		store: &sqlStore{
			db: db,
		},
	}
}

func (s *Service) Create(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	return s.store.Insert(ctx, cmd)
}

func (s *Service) Update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (*playlist.PlaylistDTO, error) {
	return s.store.Update(ctx, cmd)
}

func (s *Service) Get(ctx context.Context, q *playlist.GetPlaylistByUidQuery) (*playlist.Playlist, error) {
	return s.store.Get(ctx, q)
}

func (s *Service) GetItems(ctx context.Context, q *playlist.GetPlaylistItemsByUidQuery) ([]playlist.PlaylistItem, error) {
	return s.store.GetItems(ctx, q)
}

func (s *Service) Search(ctx context.Context, q *playlist.GetPlaylistsQuery) (playlist.Playlists, error) {
	playlists, err := s.store.List(ctx, q)
	if err != nil {
		return nil, err
	}

	// TODO: single call
	if q.IncludeItems {
		for _, p := range playlists {
			items, err := s.GetItems(ctx, &playlist.GetPlaylistItemsByUidQuery{
				PlaylistUID: p.UID,
				OrgId:       p.OrgId,
			})
			if err != nil {
				return nil, err
			}

			itemsDTO := []playlist.PlaylistItemDTO{}
			for _, i := range items {
				itemsDTO = append(itemsDTO, i.DTO())
			}
			p.Items = itemsDTO
		}
	}

	return playlists, nil
}

func (s *Service) Delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	return s.store.Delete(ctx, cmd)
}
