package resource

import (
	"context"

	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

func NewSearchClient(dual dualwrite.Service, gr schema.GroupResource, unifiedClient ResourceIndexClient, legacyClient ResourceIndexClient) ResourceIndexClient {
	status, _ := dual.Status(context.Background(), gr)
	if status.Runtime && dual.ShouldManage(gr) {
		return &searchWrapper{
			dual:          dual,
			groupResource: gr,
			unifiedClient: unifiedClient,
			legacyClient:  legacyClient,
		}
	}
	if status.ReadUnified {
		return unifiedClient
	}
	return legacyClient
}

type searchWrapper struct {
	dual          dualwrite.Service
	groupResource schema.GroupResource

	unifiedClient ResourceIndexClient
	legacyClient  ResourceIndexClient
}

func (s *searchWrapper) GetStats(ctx context.Context, in *ResourceStatsRequest, opts ...grpc.CallOption) (*ResourceStatsResponse, error) {
	client := s.legacyClient
	unified, err := s.dual.ReadFromUnified(ctx, s.groupResource)
	if err != nil {
		return nil, err
	}
	if unified {
		client = s.unifiedClient
	}
	return client.GetStats(ctx, in, opts...)
}

func (s *searchWrapper) Search(ctx context.Context, in *ResourceSearchRequest, opts ...grpc.CallOption) (*ResourceSearchResponse, error) {
	client := s.legacyClient
	unified, err := s.dual.ReadFromUnified(ctx, s.groupResource)
	if err != nil {
		return nil, err
	}
	if unified {
		client = s.unifiedClient
	}
	return client.Search(ctx, in, opts...)
}
