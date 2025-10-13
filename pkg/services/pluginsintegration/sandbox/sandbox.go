package sandbox

import "github.com/grafana/grafana/pkg/setting"

type Sandbox interface {
	Plugins() ([]string, error)
}

type Service struct {
	cfg *setting.Cfg
}

func ProvideService(cfg *setting.Cfg) *Service {
	return &Service{
		cfg: cfg,
	}
}

func (s *Service) Plugins() ([]string, error) {
	return s.cfg.EnableFrontendSandboxForPlugins, nil
}
