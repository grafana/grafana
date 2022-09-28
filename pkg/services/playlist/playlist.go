package playlist

import (
	"context"
)

type Service interface {
	Create(context.Context, *CreatePlaylistCommand) (*Playlist, error)
	Update(context.Context, *UpdatePlaylistCommand) (*PlaylistDTO, error)
	Get(context.Context, *GetPlaylistByUidQuery) (*Playlist, error)
	GetWithItems(context.Context, *GetPlaylistByUidQuery) (*PlaylistDTO, error)
	Search(context.Context, *GetPlaylistsQuery) (Playlists, error)
	Delete(ctx context.Context, cmd *DeletePlaylistCommand) error
}
