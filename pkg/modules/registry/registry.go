package registry

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-apiserver/pkg/certgenerator"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore/migrations"
)

type Registry interface{}

type registry struct {
	moduleManager modules.Manager
	log           log.Logger
}

func ProvideRegistry(
	moduleManager modules.Manager,
	apiServer grafanaapiserver.Service,
	backgroundServiceRunner *backgroundsvcs.BackgroundServiceRunner,
	certGenerator certgenerator.ServiceInterface,
	httpServer *api.HTTPServer,
	provisioningService *provisioning.ProvisioningServiceImpl,
	secretsMigrator *migrations.SecretMigrationProviderImpl,
) *registry {
	return newRegistry(
		log.New("modules.registry"),
		moduleManager,
		apiServer,
		backgroundServiceRunner,
		certGenerator,
		httpServer,
		provisioningService,
		secretsMigrator,
	)
}

func newRegistry(logger log.Logger, moduleManager modules.Manager, svcs ...services.NamedService) *registry {
	r := &registry{
		log:           logger,
		moduleManager: moduleManager,
	}

	// Register (invisible) modules which act solely as dependencies to module targets
	for _, svc := range svcs {
		s := svc
		logger.Debug("Registering invisible module", "name", s.ServiceName())
		r.moduleManager.RegisterInvisibleModule(s.ServiceName(), func() (services.Service, error) {
			return s, nil
		})
	}

	logger.Debug("Registering module", "name", modules.All)
	r.moduleManager.RegisterModule(modules.All, nil)

	return r
}
