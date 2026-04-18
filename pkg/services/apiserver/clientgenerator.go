package apiserver

import (
	"context"
	"sync"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ProvideClientGenerator creates a lazy-initialized ClientGenerator.
func ProvideClientGenerator(restConfigProvider RestConfigProvider) resource.ClientGenerator {
	return &lazyClientGenerator{
		restConfigProvider: restConfigProvider,
	}
}

type lazyClientGenerator struct {
	restConfigProvider RestConfigProvider
	clientGenerator    resource.ClientGenerator
	initOnce           sync.Once
	initError          error
}

func (g *lazyClientGenerator) init() error {
	g.initOnce.Do(func() {
		restConfig, err := g.restConfigProvider.GetRestConfig(context.Background())
		if err != nil {
			g.initError = err
			return
		}
		restConfig.APIPath = "apis"
		g.clientGenerator = k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())
	})
	return g.initError
}

func (g *lazyClientGenerator) ClientFor(kind resource.Kind) (resource.Client, error) {
	if err := g.init(); err != nil {
		return nil, err
	}
	return g.clientGenerator.ClientFor(kind)
}

func (g *lazyClientGenerator) GetCustomRouteClient(gv schema.GroupVersion, plural string) (resource.CustomRouteClient, error) {
	if err := g.init(); err != nil {
		return nil, err
	}
	return g.clientGenerator.GetCustomRouteClient(gv, plural)
}
