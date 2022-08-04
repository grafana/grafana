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
				db: db,
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
	return s.store.List(ctx, q)
}

func (s *Service) Delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	return s.store.Delete(ctx, cmd)
}
