package playlist

import (
	"context"
)

type Service interface {
	Create(context.Context, *CreatePlaylistCommand) (*Playlist, error)
	Update(context.Context, *UpdatePlaylistCommand) (*PlaylistDTO, error)
	GetWithoutItems(context.Context, *GetPlaylistByUidQuery) (*Playlist, error)
	Get(context.Context, *GetPlaylistByUidQuery) (*PlaylistDTO, error)
	Search(context.Context, *GetPlaylistsQuery) (Playlists, error)
	Delete(ctx context.Context, cmd *DeletePlaylistCommand) error

	// This is optimized for the kubernetes list command that returns full bodies in the list
	List(ctx context.Context, orgId int64) ([]PlaylistDTO, error)
}
