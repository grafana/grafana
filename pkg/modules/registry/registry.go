package registry

import (
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
)

type Registry interface{}

type registry struct {
	moduleManager modules.Manager
	log           log.Logger
}

func ProvideRegistry(
	moduleManager modules.Manager,
) *registry {
	return newRegistry(
		log.New("modules.registry"),
		moduleManager,
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

	return r
}
