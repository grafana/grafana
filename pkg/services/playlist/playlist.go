package playlist

import (
	"context"
)

type Service interface {
	SearchPlaylists(ctx context.Context, cmd *GetPlaylistsQuery) (SearchPlaylistsResult, error)
	GetPlaylist(ctx context.Context, query *GetPlaylistByIdQuery) (GetPlaylistResult, error)
	GetPlaylistItem(ctx context.Context, query *GetPlaylistItemsByIdQuery) (GetPlaylistItemsResult, error)
	DeletePlaylist(ctx context.Context, cmd *DeletePlaylistCommand) error
	CreatePlaylist(ctx context.Context, cmd *CreatePlaylistCommand) (CreatePlaylistResult, error)
	UpdatePlaylist(ctx context.Context, cmd *UpdatePlaylistCommand) (UpdatePlaylistResult, error)
}
