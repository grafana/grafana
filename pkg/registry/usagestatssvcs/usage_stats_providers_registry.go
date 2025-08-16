package usagestatssvcs

import (
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acdatabase "github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/user"
)

func ProvideUsageStatsProvidersRegistry(
	accesscontrol accesscontrol.Service,
	acDB *acdatabase.AccessControlStore,
	user user.Service,
) *UsageStatsProvidersRegistry {
	return NewUsageStatsProvidersRegistry(
		accesscontrol,
		acDB,
		user,
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
