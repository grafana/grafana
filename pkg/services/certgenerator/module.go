package certgenerator

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-apiserver/pkg/certgenerator"

	"github.com/grafana/grafana/pkg/modules"
)

type ModuleRegistration struct{}

func ProvideModuleRegistration(svc certgenerator.ServiceInterface, mod modules.Manager) *ModuleRegistration {
	mod.RegisterModule(modules.CertGenerator, func() (services.Service, error) {
		return svc, nil
	})
	return &ModuleRegistration{}
}
