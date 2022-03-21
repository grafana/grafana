package playlistimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type serviceImpl struct {
	playlistStore store
}

func ProvideService(sqlstore sqlstore.Store) playlist.Service {
	s := &serviceImpl{playlistStore: newPlaylistStore(sqlstore)}
	return s
}

func (s *serviceImpl) SearchPlaylists(ctx context.Context, query *playlist.GetPlaylistsQuery) (playlist.SearchPlaylistsResult, error) {
	return s.playlistStore.search(ctx, query)
}

func (s *serviceImpl) GetPlaylist(ctx context.Context, query *playlist.GetPlaylistByIdQuery) (playlist.GetPlaylistResult, error) {
	if err := query.Validate(); err != nil {
		return playlist.GetPlaylistResult{}, err
	}
	return s.playlistStore.getById(ctx, query)
}

func (s *serviceImpl) GetPlaylistItem(ctx context.Context, query *playlist.GetPlaylistItemsByIdQuery) (playlist.GetPlaylistItemsResult, error) {
	if err := query.Validate(); err != nil {
		return playlist.GetPlaylistItemsResult{}, err
	}
	return s.playlistStore.getItemsById(ctx, query)
}

func (s *serviceImpl) DeletePlaylist(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	return s.playlistStore.delete(ctx, cmd)
}

func (s *serviceImpl) CreatePlaylist(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (playlist.CreatePlaylistResult, error) {
	return s.playlistStore.create(ctx, cmd)
}

func (s *serviceImpl) UpdatePlaylist(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (playlist.UpdatePlaylistResult, error) {
	return s.playlistStore.update(ctx, cmd)
}
