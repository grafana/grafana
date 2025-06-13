package federated

import (
	"context"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func NewFederatedClient(base resource.ResourceClient, sql legacysql.LegacyDatabaseProvider) resource.ResourceClient {
	return &federatedClient{
		ResourceClient: base,
		stats: &LegacyStatsGetter{
			SQL: sql,
		},
	}
}

type federatedClient struct {
	resource.ResourceClient

	// Local DB for folder stats query
	stats *LegacyStatsGetter
}

// Get the resource stats
func (s *federatedClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	rsp, err := s.ResourceClient.GetStats(ctx, in, opts...)
	if err != nil {
		return nil, err
	}

	// When folder stats are requested -- join in the legacy values
	if in.Folder != "" {
		more, err := s.stats.GetStats(ctx, in)
		if err != nil {
			return rsp, err
		}
		rsp.Stats = append(rsp.Stats, more.Stats...)
	}

	return rsp, err
}
