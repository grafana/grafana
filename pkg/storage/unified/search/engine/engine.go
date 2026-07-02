package engine

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// SearchEngine is the engine-agnostic contract for indexing and querying.
// Bleve and Elasticsearch implement it in-process; the gRPC client adapter
// in engine/grpc implements it for remote engines. Authorization is expressed
// via SearchRequest.Authz or applied by the caller before/after Search.
type SearchEngine interface {
	Index(ctx context.Context, req *resourcepb.IndexRequest) (*resourcepb.IndexResponse, error)
	Search(ctx context.Context, req *resourcepb.SearchRequest) (*resourcepb.SearchResponse, error)
	Stats(ctx context.Context, req *resourcepb.StatsRequest) (*resourcepb.StatsResponse, error)
	Refresh(ctx context.Context, req *resourcepb.RefreshRequest) (*resourcepb.RefreshResponse, error)
	DeleteIndex(ctx context.Context, req *resourcepb.DeleteIndexRequest) (*resourcepb.DeleteIndexResponse, error)
	Health(ctx context.Context, req *resourcepb.HealthRequest) (*resourcepb.HealthResponse, error)
}
