package registry

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/k8s/informer"
	publicdashboardWebhooks "github.com/grafana/grafana/pkg/services/k8s/resources/publicdashboard/webhooks"
	"github.com/grafana/grafana/pkg/services/provisioning"
)

type Registry interface{}

type registry struct {
	ModuleManager modules.Manager
}

func ProvideRegistry(
	moduleManager modules.Manager,
	apiServer apiserver.Service,
	certGenerator certgenerator.Service,
	crdRegistry *corecrd.Registry,
	informerService informer.Service,
	clientsetService client.Service,
	httpServer *api.HTTPServer,
	pdWebhooks *publicdashboardWebhooks.WebhooksAPI,
	provisioning *provisioning.ProvisioningServiceImpl,
) *registry {
	return NewRegistry(
		moduleManager,
		apiServer,
		certGenerator,
		crdRegistry,
		informerService,
		clientsetService,
		httpServer,
		pdWebhooks,
		provisioning,
	)
}

func NewRegistry(moduleManager modules.Manager, allServices ...services.NamedService) *registry {
	logger := log.New("modules.registry")
	r := &registry{
		ModuleManager: moduleManager,
	}

	for _, service := range allServices {
		s := service
		logger.Debug("Registering invisible module", "name", s.ServiceName())
		r.ModuleManager.RegisterInvisibleModule(s.ServiceName(), func() (services.Service, error) {
			return s, nil
		})
	}

	logger.Debug("Registering module", "name", modules.Kubernetes)
	r.ModuleManager.RegisterModule(modules.Kubernetes, nil)
	logger.Debug("Registering module", "name", modules.All)
	r.ModuleManager.RegisterModule(modules.All, nil)

	return r
}
