package model

import (
	"context"
	"fmt"
	"net/http"

	claims "github.com/grafana/authlib/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// DisabledServer preserves embedded RPC responses when indexing is disabled.
type DisabledServer struct {
	resourcepb.UnimplementedResourceIndexServer
	resourcepb.UnimplementedManagedObjectIndexServer
	resourcepb.UnimplementedDiagnosticsServer
	Stats interface {
		GetStats(context.Context, *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error)
	}
}

func (*DisabledServer) Init(context.Context) error { return nil }
func (*DisabledServer) Stop(context.Context) error { return nil }
func (*DisabledServer) Search(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return nil, fmt.Errorf("search index not configured")
}
func (*DisabledServer) VectorSearch(context.Context, *resourcepb.VectorSearchRequest) (*resourcepb.VectorSearchResponse, error) {
	return nil, fmt.Errorf("vector search is not configured")
}
func (*DisabledServer) HybridSearch(context.Context, *resourcepb.HybridSearchRequest) (*resourcepb.HybridSearchResponse, error) {
	return nil, status.Error(codes.Unimplemented, "search index not configured")
}
func (s *DisabledServer) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	if s.Stats != nil {
		return s.Stats.GetStats(ctx, req)
	}
	return nil, fmt.Errorf("search index not configured")
}
func (*DisabledServer) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	if err := requireNamespace(ctx, req.Namespace); err != nil {
		return &resourcepb.ListManagedObjectsResponse{Error: err}, nil
	}
	return nil, fmt.Errorf("search index not configured")
}
func (*DisabledServer) CountManagedObjects(ctx context.Context, req *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	if err := requireNamespace(ctx, req.Namespace); err != nil {
		return &resourcepb.CountManagedObjectsResponse{Error: err}, nil
	}
	return nil, fmt.Errorf("search index not configured")
}
func (*DisabledServer) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	if err := requireNamespace(ctx, req.Namespace); err != nil {
		return &resourcepb.RebuildIndexesResponse{Error: err}, nil
	}
	return nil, fmt.Errorf("search index not configured")
}
func requireNamespace(ctx context.Context, namespace string) *resourcepb.ErrorResult {
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return &resourcepb.ErrorResult{Message: "no user found in context", Code: http.StatusUnauthorized}
	}
	if !claims.NamespaceMatches(user.GetNamespace(), namespace) {
		return &resourcepb.ErrorResult{Message: "namespace mismatch", Code: http.StatusForbidden}
	}
	return nil
}
