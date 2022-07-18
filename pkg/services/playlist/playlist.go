package playlist

import (
	"context"
)

type Service interface {
	Create(context.Context, *CreatePlaylistCommand) (*Playlist, error)
	Update(context.Context, *UpdatePlaylistCommand) (*PlaylistDTO, error)
	Get(context.Context, *GetPlaylistByUidQuery) (*Playlist, error)
	GetItems(context.Context, *GetPlaylistItemsByUidQuery) ([]PlaylistItem, error)
	Search(context.Context, *GetPlaylistsQuery) (Playlists, error)
	Delete(ctx context.Context, cmd *DeletePlaylistCommand) error
}
