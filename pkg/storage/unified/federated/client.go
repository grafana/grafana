package federated

import (
	"context"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func NewFederatedSearchClient(base resource.SearchClient, sql legacysql.LegacyDatabaseProvider, disableDashboardsFallback bool, disableFoldersFallback bool) resource.SearchClient {
	return &federatedClient{
		SearchClient: base,
		stats: &LegacyStatsGetter{
			SQL:                          sql,
			DisableSQLFallbackDashboards: disableDashboardsFallback,
			DisableSQLFallbackFolders:    disableFoldersFallback,
		},
	}
}

type federatedClient struct {
	resource.SearchClient

	// Local DB for folder stats query
	stats *LegacyStatsGetter
}

// Get the resource stats
func (s *federatedClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	rsp, err := s.SearchClient.GetStats(ctx, in, opts...)
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
