package usagestatssvcs

import (
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	encrypt "github.com/grafana/grafana/pkg/services/encryption/service"
	secrets "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
)

func ProvideUsageStatsProvidersRegistry(
	accesscontrol accesscontrol.Service,
	user user.Service,
	remoteCache *remotecache.RemoteCache,
	encryptionService *encrypt.Service,
	secretsService *secrets.SecretsService,
) *UsageStatsProvidersRegistry {
	return NewUsageStatsProvidersRegistry(
		accesscontrol,
		user,
		remoteCache,
		encryptionService,
		secretsService,
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
