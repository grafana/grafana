package resource

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// HybridSearch implements ResourceIndexServer.
func (s *searchServer) HybridSearch(ctx context.Context, req *resourcepb.HybridSearchRequest) (*resourcepb.HybridSearchResponse, error) {
	return nil, status.Error(codes.Unimplemented, "hybrid search not implemented")
}
