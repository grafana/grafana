package playlist

import (
	"context"

	"github.com/grafana/grafana/pkg/kinds/playlist"
)

type Service interface {
	Create(context.Context, *CreatePlaylistCommand) (*Playlist, error)
	Update(context.Context, *UpdatePlaylistCommand) (*PlaylistDTO, error)
	GetWithoutItems(context.Context, *GetPlaylistByUidQuery) (*Playlist, error)
	Get(context.Context, *GetPlaylistByUidQuery) (*playlist.Playlist, error)
	Search(context.Context, *GetPlaylistsQuery) (Playlists, error)
	Delete(ctx context.Context, cmd *DeletePlaylistCommand) error
}
