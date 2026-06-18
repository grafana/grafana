package grpcengine

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/engine"
)

// Server exposes a SearchEngine over gRPC. Authorization uses AuthzFilter on
// the wire.
type Server struct {
	resourcepb.UnimplementedSearchEngineServer
	Engine engine.SearchEngine
}

func NewServer(eng engine.SearchEngine) *Server {
	return &Server{Engine: eng}
}

func (s *Server) Index(ctx context.Context, req *resourcepb.IndexRequest) (*resourcepb.IndexResponse, error) {
	return s.Engine.Index(ctx, req)
}

func (s *Server) Search(ctx context.Context, req *resourcepb.SearchRequest) (*resourcepb.SearchResponse, error) {
	return s.Engine.Search(ctx, req)
}

func (s *Server) Stats(ctx context.Context, req *resourcepb.StatsRequest) (*resourcepb.StatsResponse, error) {
	return s.Engine.Stats(ctx, req)
}

func (s *Server) Refresh(ctx context.Context, req *resourcepb.RefreshRequest) (*resourcepb.RefreshResponse, error) {
	return s.Engine.Refresh(ctx, req)
}

func (s *Server) DeleteIndex(ctx context.Context, req *resourcepb.DeleteIndexRequest) (*resourcepb.DeleteIndexResponse, error) {
	return s.Engine.DeleteIndex(ctx, req)
}

func (s *Server) Health(ctx context.Context, req *resourcepb.HealthRequest) (*resourcepb.HealthResponse, error) {
	return s.Engine.Health(ctx, req)
}
