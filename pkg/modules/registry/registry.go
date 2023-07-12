package registry

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-apiserver/pkg/certgenerator"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry/coregrd"
	"github.com/grafana/grafana/pkg/server/backgroundsvcs"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/provisioning"
)

type Registry interface{}

type registry struct {
	moduleManager modules.Manager
	log           log.Logger
}

func ProvideRegistry(
	moduleManager modules.Manager,
	apiServer apiserver.Service,
	backgroundServiceRunner *backgroundsvcs.BackgroundServiceRunner,
	clientset client.Service,
	certGenerator certgenerator.ServiceInterface,
	httpServer *api.HTTPServer,
	provisioning *provisioning.ProvisioningServiceImpl,
	coreGRDRegistry *coregrd.Registry,
) *registry {
	return newRegistry(
		log.New("modules.registry"),
		moduleManager,
		apiServer,
		backgroundServiceRunner,
		clientset,
		certGenerator,
		httpServer,
		provisioning,
		coreGRDRegistry,
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

	// Register module targets
	logger.Debug("Registering module", "name", modules.All)
	r.moduleManager.RegisterModule(modules.All, nil)

	logger.Debug("Registering module", "name", modules.Kubernetes)
	r.moduleManager.RegisterModule(modules.Kubernetes, nil)

	return r
}
