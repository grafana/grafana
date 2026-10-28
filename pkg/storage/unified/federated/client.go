package federated

import (
	"context"

	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/federated")

func NewFederatedClient(base resource.ResourceClient, sql legacysql.LegacyDatabaseProvider, cfg *setting.Cfg) resource.ResourceClient {
	client := &federatedClient{
		ResourceClient: base,
		stats: &LegacyStatsGetter{
			SQL: sql,
			Cfg: cfg,
		},
	}
	if stopper, ok := base.(resource.ResourceServerStopper); ok {
		return struct {
			resource.ResourceClient
			resource.ResourceServerStopper
		}{client, stopper}
	}
	return client
}

type federatedClient struct {
	resource.ResourceClient

	// Local DB for folder stats query
	stats *LegacyStatsGetter
}

// Get the resource stats
func (s *federatedClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := tracer.Start(ctx, "federated.federatedClient.GetStats")
	defer span.End()

	rsp, err := s.ResourceClient.GetStats(ctx, in, opts...)
	if err := resource.ErrorFromResponse(rsp.GetError(), err); err != nil {
		return nil, tracing.Error(span, err)
	}

	// When folder stats are requested -- join in the legacy values. Folder
	// holds the pre-expanded descendant set passed by callers that need
	// recursive counts (see folders apiserver /counts subresource).
	if len(in.Folder) > 0 {
		more, err := s.stats.GetStats(ctx, in)
		if err != nil {
			return rsp, tracing.Error(span, err)
		}
		rsp.Stats = append(rsp.Stats, more.Stats...)
	}

	return rsp, err
}
