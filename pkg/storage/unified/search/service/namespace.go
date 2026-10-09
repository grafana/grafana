package service

import (
	"context"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
)

// WithStorageNamespaceChecks retains the checks previously applied by embedded storage handlers.
func WithStorageNamespaceChecks(server searchmodel.SearchServer) searchmodel.SearchServer {
	return &namespaceCheckedServer{SearchServer: server}
}

type namespaceCheckedServer struct{ searchmodel.SearchServer }

func (s *namespaceCheckedServer) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	if err := resource.RequireUserNamespace(ctx, req.Namespace); err != nil {
		return &resourcepb.ListManagedObjectsResponse{Error: err}, nil
	}
	return s.SearchServer.ListManagedObjects(ctx, req)
}
func (s *namespaceCheckedServer) CountManagedObjects(ctx context.Context, req *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	if err := resource.RequireUserNamespace(ctx, req.Namespace); err != nil {
		return &resourcepb.CountManagedObjectsResponse{Error: err}, nil
	}
	return s.SearchServer.CountManagedObjects(ctx, req)
}
func (s *namespaceCheckedServer) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	if err := resource.RequireUserNamespace(ctx, req.Namespace); err != nil {
		return &resourcepb.RebuildIndexesResponse{Error: err}, nil
	}
	return s.SearchServer.RebuildIndexes(ctx, req)
}
