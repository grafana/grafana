package registry

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/k8s/informer"
	"github.com/grafana/grafana/pkg/services/k8s/kine"
)

type Registry interface{}

type registry struct {
	ModuleManager modules.Manager
}

func ProvideRegistry(
	moduleManager modules.Manager,
	apiServer apiserver.Service,
	crdRegistry *corecrd.Registry,
	kineService kine.Service,
	informerService informer.Service,
	clientsetService client.Service,
) *registry {
	return NewRegistry(
		moduleManager,
		apiServer,
		crdRegistry,
		kineService,
		informerService,
		clientsetService,
	)
}

func NewRegistry(moduleManager modules.Manager, allServices ...services.NamedService) *registry {
	r := &registry{
		ModuleManager: moduleManager,
	}

	for _, s := range allServices {
		r.ModuleManager.RegisterInvisibleModule(s.ServiceName(), func() (services.Service, error) {
			return s, nil
		})
	}

	r.ModuleManager.RegisterModule(modules.Kubernetes, nil)
	r.ModuleManager.RegisterModule(modules.All, nil)

	return r
}
