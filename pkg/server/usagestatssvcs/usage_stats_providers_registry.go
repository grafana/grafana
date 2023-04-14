package usagestatssvcs

import (
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func ProvideUsageStatsProvidersRegistry(
	accesscontrol accesscontrol.Service,
) *UsageStatsProvidersRegistry {
	return NewUsageStatsProvidersRegistry(
		accesscontrol,
	)
}

type UsageStatsProvidersRegistry struct {
	Services []registry.ProvidesUsageStats
}

func NewUsageStatsProvidersRegistry(services ...registry.ProvidesUsageStats) *UsageStatsProvidersRegistry {
	return &UsageStatsProvidersRegistry{services}
}

func (r *UsageStatsProvidersRegistry) GetServices() []registry.ProvidesUsageStats {
	return r.Services
}
