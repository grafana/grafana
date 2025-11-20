package noopsearch

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"google.golang.org/grpc"
)

var (
	_ resourcepb.ResourceIndexClient = (*NoopLegacySearchClient)(nil)

	errUnavailable = errors.New("unavailable functionality")
)

type NoopLegacySearchClient struct{}

func ProvideLegacySearchClient() *NoopLegacySearchClient {
	return &NoopLegacySearchClient{}
}

// Search implements ResourceIndexClient.
func (c *NoopLegacySearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return nil, errUnavailable
}

// GetStats implements ResourceIndexClient.
func (c *NoopLegacySearchClient) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest, _ ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return nil, errUnavailable
}
