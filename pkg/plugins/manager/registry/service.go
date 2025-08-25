package registry

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/plugins"
)

var _ Service = (*ServiceWrapper)(nil)

type ServiceWrapper struct {
	installRegistry  *InstallAPIRegistry
	inMemoryRegistry *InMemory
}

func ProvideServiceWrapper(installRegistry *InstallAPIRegistry, inMemoryRegistry *InMemory) *ServiceWrapper {
	return &ServiceWrapper{
		installRegistry:  installRegistry,
		inMemoryRegistry: inMemoryRegistry,
	}
}

func (s *ServiceWrapper) getService() (Service, error) {
	ok, err := s.installRegistry.Enabled()
	if err != nil {
		return nil, err
	}
	if !ok {
		return s.inMemoryRegistry, nil
	}
	return s.installRegistry, nil
}

func (s *ServiceWrapper) Plugin(ctx context.Context, id, version string) (*plugins.Plugin, bool) {
	log := logging.FromContext(ctx)
	service, err := s.getService()
	if err != nil {
		log.Error("failed to get service", "error", err)
		return nil, false
	}
	return service.Plugin(ctx, id, version)
}

func (s *ServiceWrapper) Plugins(ctx context.Context) []*plugins.Plugin {
	log := logging.FromContext(ctx)
	service, err := s.getService()
	if err != nil {
		log.Error("failed to get service", "error", err)
		return nil
	}
	return service.Plugins(ctx)
}

func (s *ServiceWrapper) Add(ctx context.Context, plugin *plugins.Plugin) error {
	service, err := s.getService()
	if err != nil {
		return err
	}
	return service.Add(ctx, plugin)
}

func (s *ServiceWrapper) Remove(ctx context.Context, id, version string) error {
	service, err := s.getService()
	if err != nil {
		return err
	}
	return service.Remove(ctx, id, version)
}
