package engine

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// SearchEngine is the engine-agnostic contract for indexing and querying.
// Bleve and Elasticsearch implement it in-process; the gRPC client adapter
// in engine/grpc implements it for remote engines.
type SearchEngine interface {
	Index(ctx context.Context, req *resourcepb.IndexRequest) (*resourcepb.IndexResponse, error)
	// checker is an in-process fast path for authz. Remote callers use
	// req.Authz instead; the gRPC adapter always passes nil here.
	Search(ctx context.Context, req *resourcepb.SearchRequest, checker authlib.ItemChecker) (*resourcepb.SearchResponse, error)
	Stats(ctx context.Context, req *resourcepb.StatsRequest) (*resourcepb.StatsResponse, error)
	Refresh(ctx context.Context, req *resourcepb.RefreshRequest) (*resourcepb.RefreshResponse, error)
	DeleteIndex(ctx context.Context, req *resourcepb.DeleteIndexRequest) (*resourcepb.DeleteIndexResponse, error)
	Health(ctx context.Context, req *resourcepb.HealthRequest) (*resourcepb.HealthResponse, error)
}
