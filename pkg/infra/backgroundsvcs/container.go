package backgroundsvcs

import "github.com/grafana/grafana/pkg/registry"

func ProvideService() *Container {
	return &Container{}
}

// Container contains the server's background services.
type Container struct {
	// BackgroundServices are registered background services.
	BackgroundServices []registry.BackgroundService
}

// AddBackgroundService adds a registry.BackgroundService.
func (c *Container) AddBackgroundService(service registry.BackgroundService) {
	c.BackgroundServices = append(c.BackgroundServices, service)
}
