package provisioning

import (
	"context"

	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/usage"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// UsageStatsServiceName is the background-service module name of [UsageStatsService].
const UsageStatsServiceName = "provisioning-usage-stats"

var _ registry.CanBeDisabled = (*UsageStatsService)(nil)

// UsageStatsService registers the provisioning usage stats collector once the
// provisioning API is served, and then waits for shutdown.
type UsageStatsService struct {
	*loopbackService
	usageStats      usagestats.Service
	namespaceLister usage.NamespaceLister
}

// ProvideUsageStatsService is called by Wire. Depending on the builder orders it
// after [RegisterAPIServer], which registers the provisioning API group with
// the API server.
func ProvideUsageStatsService(cfg *setting.Cfg, builder *APIBuilder, usageStats usagestats.Service, orgSvc org.Service) *UsageStatsService {
	s := &UsageStatsService{usageStats: usageStats, namespaceLister: usage.UsageNamespaceLister(cfg, orgSvc)}
	s.loopbackService = newLoopbackService(UsageStatsServiceName, builder, cfg.DisableControllers, s.register)
	return s
}

// IsDisabled implements registry.CanBeDisabled.
func (s *UsageStatsService) IsDisabled() bool {
	return s.loopbackService.IsDisabled() || s.usageStats == nil
}

func (s *UsageStatsService) register(ctx context.Context, _ *clientrest.Config) error {
	b := s.builder
	s.usageStats.RegisterMetricsFunc(usage.MetricCollector(b.tracer, s.namespaceLister, b.repoLister.List, connection.NewStorageLister(b.connectionStore).List, b.unified))
	<-ctx.Done()
	return context.Cause(ctx)
}
