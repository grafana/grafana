package apiserver

import (
	"context"
	"sync"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/services/apiserver/restconfig"
)

// ProvideClientGenerator creates a lazy-initialized ClientGenerator.
func ProvideClientGenerator(restConfigProvider restconfig.RestConfigProvider) resource.ClientGenerator {
	return &lazyClientGenerator{
		restConfigProvider: restConfigProvider,
	}
}

type lazyClientGenerator struct {
	restConfigProvider restconfig.RestConfigProvider
	clientGenerator    resource.ClientGenerator
	initOnce           sync.Once
	initError          error
}

func (g *lazyClientGenerator) ClientFor(kind resource.Kind) (resource.Client, error) {
	g.initOnce.Do(func() {
		restConfig, err := g.restConfigProvider.GetRestConfig(context.Background())
		if err != nil {
			g.initError = err
			return
		}
		restConfig.APIPath = "apis"
		g.clientGenerator = k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())
	})

	if g.initError != nil {
		return nil, g.initError
	}

	return g.clientGenerator.ClientFor(kind)
}
