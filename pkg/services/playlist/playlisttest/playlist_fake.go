package playlisttest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/playlist"
)

type FakePlaylistService struct {
	ExpectedError error
}

func NewPlaylistServiceFake() *FakePlaylistService {
	return &FakePlaylistService{}
}

func (f *FakePlaylistService) SearchPlaylists(ctx context.Context, cmd *playlist.GetPlaylistsQuery) (playlist.SearchPlaylistsResult, error) {
	return playlist.SearchPlaylistsResult{}, f.ExpectedError
}

func (f *FakePlaylistService) GetPlaylist(ctx context.Context, query *playlist.GetPlaylistByIdQuery) (playlist.GetPlaylistResult, error) {
	return &playlist.Playlist{}, f.ExpectedError
}

func (f *FakePlaylistService) GetPlaylistItems(ctx context.Context, query *playlist.GetPlaylistItemsByIdQuery) (playlist.GetPlaylistItemsResult, error) {
	return playlist.GetPlaylistItemsResult{}, f.ExpectedError
}

func (f *FakePlaylistService) DeletePlaylist(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	return f.ExpectedError
}

func (f *FakePlaylistService) CreatePlaylist(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (playlist.CreatePlaylistResult, error) {
	return &playlist.Playlist{}, f.ExpectedError
}

func (f *FakePlaylistService) UpdatePlaylist(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (playlist.UpdatePlaylistResult, error) {
	return &playlist.PlaylistDTO{}, f.ExpectedError
}
