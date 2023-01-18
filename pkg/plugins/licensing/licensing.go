package licensing

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	licensePath string
	license     models.Licensing
}

func ProvideLicensing(cfg *setting.Cfg, l models.Licensing) *Service {
	return &Service{
		licensePath: cfg.EnterpriseLicensePath,
		license:     l,
	}
}

func (l Service) Environment() []string {
	var env []string
	if envProvider, ok := l.license.(models.LicenseEnvironment); ok {
		for k, v := range envProvider.Environment() {
			env = append(env, fmt.Sprintf("%s=%s", k, v))
		}
	}
	return env
}

func (l Service) Edition() string {
	return l.license.Edition()
}

func (l Service) Path() string {
	return l.licensePath
}
