package registry

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/server/backgroundsvcs"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
)

type Registry interface{}

type registry struct {
	moduleManager modules.Manager
}

func ProvideRegistry(
	moduleManager modules.Manager,
	backgroundServiceRunner *backgroundsvcs.BackgroundServiceRunner,
) *registry {
	return NewRegistry(
		moduleManager,
		backgroundServiceRunner,
	)
}

func NewRegistry(moduleManager modules.Manager, allServices ...services.NamedService) *registry {
	logger := log.New("modules.registry")
	r := &registry{
		moduleManager: moduleManager,
	}

	for _, service := range allServices {
		s := service
		logger.Debug("Registering invisible module", "name", s.ServiceName())
		r.moduleManager.RegisterInvisibleModule(s.ServiceName(), func() (services.Service, error) {
			return s, nil
		})
	}

	logger.Debug("Registering module", "name", modules.All)
	r.moduleManager.RegisterModule(modules.All, nil)

	return r
}
