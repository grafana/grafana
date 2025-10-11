package plugins

import (
	"context"
	"sync"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/pkg/services/apiserver"
)

var _ resource.ClientGenerator = (*ClientRegistry)(nil)

type ClientRegistry struct {
	mu                 sync.Mutex
	restConfigProvider apiserver.RestConfigProvider
	registry           *k8s.ClientRegistry
}

func ProvideClientRegistry(restConfigProvider apiserver.RestConfigProvider) *ClientRegistry {
	return &ClientRegistry{
		restConfigProvider: restConfigProvider,
	}
}

func (c *ClientRegistry) ClientFor(kind resource.Kind) (resource.Client, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.registry != nil {
		return c.registry.ClientFor(kind)
	}
	restConfig, err := c.restConfigProvider.GetRestConfig(context.Background())
	if err != nil {
		return nil, err
	}
	restConfig.APIPath = "apis"
	c.registry = k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())
	return c.registry.ClientFor(kind)
}
