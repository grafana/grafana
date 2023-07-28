package grafanaapiserver

import (
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/modules"
)

type ModuleRegistration struct{}

func ProvideModuleRegistration(manager modules.Manager, svc Service) *ModuleRegistration {
	manager.RegisterInvisibleModule(modules.GrafanaAPIServer, func() (services.Service, error) {
		return svc, nil
	})
	return &ModuleRegistration{}
}
