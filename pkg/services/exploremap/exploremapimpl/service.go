package exploremapimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/exploremap"
	"github.com/grafana/grafana/pkg/services/exploremap/realtime"
	"github.com/grafana/grafana/pkg/services/live"
)

type Service struct {
	store  store
	tracer tracing.Tracer
	hub    *realtime.OperationHub
}

var _ exploremap.Service = &Service{}

// storeAdapter adapts the internal store interface to the realtime Store interface
type storeAdapter struct {
	store store
}

func (s *storeAdapter) Update(ctx context.Context, cmd *exploremap.UpdateExploreMapCommand) (*exploremap.ExploreMapDTO, error) {
	return s.store.Update(ctx, cmd)
}

func (s *storeAdapter) Get(ctx context.Context, query *exploremap.GetExploreMapByUIDQuery) (*exploremap.ExploreMapDTO, error) {
	// Get returns ExploreMap, but we need ExploreMapDTO
	mapData, err := s.store.Get(ctx, query)
	if err != nil {
		return nil, err
	}
	return &exploremap.ExploreMapDTO{
		UID:       mapData.UID,
		Title:     mapData.Title,
		Data:      mapData.Data,
		CreatedBy: mapData.CreatedBy,
		UpdatedBy: mapData.UpdatedBy,
		CreatedAt: mapData.CreatedAt,
		UpdatedAt: mapData.UpdatedAt,
	}, nil
}

func ProvideService(db db.DB, tracer tracing.Tracer, liveService *live.GrafanaLive) exploremap.Service {
	store := &sqlStore{
		db: db,
	}

	// Create adapter for realtime hub
	adapter := &storeAdapter{store: store}

	// Create operation hub for CRDT synchronization
	hub := realtime.NewOperationHub(liveService, adapter)

	// Register channel handler with Grafana Live
	channelHandler := realtime.NewExploreMapChannelHandler(hub)
	liveService.GrafanaScope.Features["explore-map"] = channelHandler

	// Start background snapshot worker (saves CRDT state to SQL every 30 seconds)
	go hub.StartSnapshotWorker(context.Background(), 30*time.Second)

	return &Service{
		tracer: tracer,
		store:  store,
		hub:    hub,
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
