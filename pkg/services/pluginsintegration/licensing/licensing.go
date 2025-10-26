package licensing

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	licensePath string
	appURL      string
	license     licensing.Licensing
}

func ProvideLicensing(cfg *setting.Cfg, l licensing.Licensing) *Service {
	return &Service{
		licensePath: cfg.EnterpriseLicensePath,
		appURL:      cfg.AppURL,
		license:     l,
	}
}

func (l *Service) Environment() []string {
	var env []string
	if envProvider, ok := l.license.(licensing.LicenseEnvironment); ok {
		for k, v := range envProvider.Environment() {
			env = append(env, fmt.Sprintf("%s=%s", k, v))
		}
	}
	return env
}

func (l *Service) Edition() string {
	return l.license.Edition()
}

func (l *Service) Path() string {
	return l.licensePath
}

func (l *Service) AppURL() string {
	return l.appURL
}

func (l *Service) ContentDeliveryPrefix() string {
	return l.license.ContentDeliveryPrefix()
}
