package provisioning

import (
	"context"

	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/usage"
)

// UsageStatsServiceName is the background-service module name of [UsageStatsService].
const UsageStatsServiceName = "provisioning-usage-stats"

var _ registry.CanBeDisabled = (*UsageStatsService)(nil)

// UsageStatsService registers the provisioning usage stats collector once the
// provisioning API is served, and then waits for shutdown.
type UsageStatsService struct {
	*loopbackService
}

// ProvideUsageStatsService is called by Wire. Depending on the builder orders it
// after [RegisterAPIService], which registers the provisioning API group with
// the API server.
func ProvideUsageStatsService(builder *APIBuilder) *UsageStatsService {
	s := &UsageStatsService{}
	s.loopbackService = newLoopbackService(UsageStatsServiceName, builder, s.register)
	return s
}

// IsDisabled implements registry.CanBeDisabled. Only the preferred version
// registers usage stats, and only when a usage stats service exists.
func (s *UsageStatsService) IsDisabled() bool {
	return s.loopbackService.IsDisabled() || !s.builder.isPreferredVersion || s.builder.usageStats == nil
}

func (s *UsageStatsService) register(ctx context.Context, _ *clientrest.Config) error {
	b := s.builder
	b.usageStats.RegisterMetricsFunc(usage.MetricCollector(b.tracer, b.usageNamespaceLister, b.repoLister.List, connection.NewStorageLister(b.connectionStore).List, b.unified))
	<-ctx.Done()
	return context.Cause(ctx)
}
