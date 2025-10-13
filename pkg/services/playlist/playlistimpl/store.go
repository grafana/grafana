package playlistimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/playlist"
)

type store interface {
	Insert(context.Context, *playlist.CreatePlaylistCommand) (*playlist.Playlist, error)
	Delete(context.Context, *playlist.DeletePlaylistCommand) error
	Get(context.Context, *playlist.GetPlaylistByUidQuery) (*playlist.Playlist, error)
	GetItems(context.Context, *playlist.GetPlaylistItemsByUidQuery) ([]playlist.PlaylistItem, error)
	List(context.Context, *playlist.GetPlaylistsQuery) (playlist.Playlists, error)
	Update(context.Context, *playlist.UpdatePlaylistCommand) (*playlist.PlaylistDTO, error)

	// This is optimized for the kubernetes list command that returns full bodies in the list
	ListAll(ctx context.Context, orgId int64) ([]playlist.PlaylistDTO, error)
}
