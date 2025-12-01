package exploremapimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/exploremap"
)

type Service struct {
	store  store
	tracer tracing.Tracer
}

var _ exploremap.Service = &Service{}

func ProvideService(db db.DB, tracer tracing.Tracer) exploremap.Service {
	return &Service{
		tracer: tracer,
		store: &sqlStore{
			db: db,
		},
	}
}

func (s *Service) Create(ctx context.Context, cmd *exploremap.CreateExploreMapCommand) (*exploremap.ExploreMap, error) {
	ctx, span := s.tracer.Start(ctx, "exploremap.Create")
	defer span.End()
	return s.store.Insert(ctx, cmd)
}

func (s *Service) Update(ctx context.Context, cmd *exploremap.UpdateExploreMapCommand) (*exploremap.ExploreMapDTO, error) {
	ctx, span := s.tracer.Start(ctx, "exploremap.Update")
	defer span.End()
	return s.store.Update(ctx, cmd)
}

func (s *Service) Get(ctx context.Context, q *exploremap.GetExploreMapByUIDQuery) (*exploremap.ExploreMapDTO, error) {
	ctx, span := s.tracer.Start(ctx, "exploremap.Get")
	defer span.End()
	v, err := s.store.Get(ctx, q)
	if err != nil {
		return nil, err
	}
	return &exploremap.ExploreMapDTO{
		UID:       v.UID,
		Title:     v.Title,
		Data:      v.Data,
		CreatedBy: v.CreatedBy,
		UpdatedBy: v.UpdatedBy,
		CreatedAt: v.CreatedAt,
		UpdatedAt: v.UpdatedAt,
	}, nil
}

func (s *Service) List(ctx context.Context, q *exploremap.GetExploreMapsQuery) (exploremap.ExploreMaps, error) {
	ctx, span := s.tracer.Start(ctx, "exploremap.List")
	defer span.End()
	return s.store.List(ctx, q)
}

func (s *Service) Delete(ctx context.Context, cmd *exploremap.DeleteExploreMapCommand) error {
	ctx, span := s.tracer.Start(ctx, "exploremap.Delete")
	defer span.End()
	return s.store.Delete(ctx, cmd)
}
