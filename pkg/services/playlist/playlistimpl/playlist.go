package playlistimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/playlist"
)

type Service struct {
	store  store
	tracer tracing.Tracer
}

var _ playlist.Service = &Service{}

func ProvideService(db db.DB, tracer tracing.Tracer) playlist.Service {
	return &Service{
		tracer: tracer,
		store: &sqlStore{
			db: db,
		},
	}
}

func (s *Service) Create(ctx context.Context, cmd *playlist.CreatePlaylistCommand) (*playlist.Playlist, error) {
	ctx, span := s.tracer.Start(ctx, "playlists.Create")
	defer span.End()
	return s.store.Insert(ctx, cmd)
}

func (s *Service) Update(ctx context.Context, cmd *playlist.UpdatePlaylistCommand) (*playlist.PlaylistDTO, error) {
	ctx, span := s.tracer.Start(ctx, "playlists.Update")
	defer span.End()
	return s.store.Update(ctx, cmd)
}

func (s *Service) GetWithoutItems(ctx context.Context, q *playlist.GetPlaylistByUidQuery) (*playlist.Playlist, error) {
	ctx, span := s.tracer.Start(ctx, "playlists.GetWithoutItems")
	defer span.End()
	return s.store.Get(ctx, q)
}

func (s *Service) Get(ctx context.Context, q *playlist.GetPlaylistByUidQuery) (*playlist.PlaylistDTO, error) {
	ctx, span := s.tracer.Start(ctx, "playlists.Get")
	defer span.End()
	v, err := s.store.Get(ctx, q)
	if err != nil {
		return nil, err
	}
	rawItems, err := s.store.GetItems(ctx, &playlist.GetPlaylistItemsByUidQuery{
		PlaylistUID: v.UID,
		OrgId:       q.OrgId,
	})
	if err != nil {
		return nil, err
	}
	items := make([]playlist.PlaylistItemDTO, len(rawItems))
	for i := 0; i < len(rawItems); i++ {
		items[i].Type = rawItems[i].Type
		items[i].Value = rawItems[i].Value

		// Add the unused title to the result
		title := rawItems[i].Title
		if title != "" {
			items[i].Title = &title
		}
	}
	return &playlist.PlaylistDTO{
		Id:        v.Id,
		Uid:       v.UID,
		Name:      v.Name,
		Interval:  v.Interval,
		Items:     items,
		CreatedAt: v.CreatedAt,
		UpdatedAt: v.UpdatedAt,
		OrgID:     v.OrgId,
	}, nil
}

func (s *Service) Search(ctx context.Context, q *playlist.GetPlaylistsQuery) (playlist.Playlists, error) {
	ctx, span := s.tracer.Start(ctx, "playlists.Search")
	defer span.End()
	return s.store.List(ctx, q)
}

func (s *Service) Delete(ctx context.Context, cmd *playlist.DeletePlaylistCommand) error {
	ctx, span := s.tracer.Start(ctx, "playlists.Delete")
	defer span.End()
	return s.store.Delete(ctx, cmd)
}

func (s *Service) List(ctx context.Context, orgId int64) ([]playlist.PlaylistDTO, error) {
	ctx, span := s.tracer.Start(ctx, "playlists.List")
	defer span.End()
	return s.store.ListAll(ctx, orgId)
}
