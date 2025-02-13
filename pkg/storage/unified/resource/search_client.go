package resource

import (
	"context"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func NewSearchClient(dual dualwrite.Service, gr schema.GroupResource, unifiedClient func(context.Context) ResourceClient, legacyClient ResourceIndexClient) ResourceIndexClient {
	return &searchWrapper{
		dual:                dual,
		unifiedClientGetter: unifiedClient,
		legacyClient:        legacyClient,
		groupResource:       gr,
	}
}

type searchWrapper struct {
	dual                dualwrite.Service
	unifiedClientGetter func(context.Context) ResourceClient
	groupResource       schema.GroupResource // Assume Dashboards+Folders use the same storage!

	unifiedClient ResourceIndexClient
	legacyClient  ResourceIndexClient
}

// GetStats implements ResourceIndexClient.
func (s *searchWrapper) GetStats(ctx context.Context, in *ResourceStatsRequest, opts ...grpc.CallOption) (*ResourceStatsResponse, error) {
	client := s.legacyClient
	if s.dual.ReadFromUnified(ctx, s.groupResource) {
		if s.unifiedClient == nil {
			s.unifiedClient = s.unifiedClientGetter(ctx) // delayed getter
		}
		client = s.unifiedClient
	}
	return client.GetStats(ctx, in, opts...)
}

// Search implements ResourceIndexClient.
func (s *searchWrapper) Search(ctx context.Context, in *ResourceSearchRequest, opts ...grpc.CallOption) (*ResourceSearchResponse, error) {
	client := s.legacyClient
	if s.dual.ReadFromUnified(ctx, s.groupResource) {
		if s.unifiedClient == nil {
			s.unifiedClient = s.unifiedClientGetter(ctx) // delayed getter
		}
		client = s.unifiedClient
	}
	return client.Search(ctx, in, opts...)
}
