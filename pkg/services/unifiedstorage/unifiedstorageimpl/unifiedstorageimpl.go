package unifiedstorageimpl

import (
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/unifiedstorage"
)

type DependencyRegistry struct {
	restCfgProvider apiserver.RestConfigProvider
	ready           chan struct{}
}

func ProvideRegistry() unifiedstorage.DependencyRegistry {
	return &DependencyRegistry{
		ready: make(chan struct{}),
	}
}

func (d *DependencyRegistry) RegisterRestConfigProvider(restConfigProvider apiserver.RestConfigProvider) {
	d.restCfgProvider = restConfigProvider
	close(d.ready)
}

func (d *DependencyRegistry) GetRestConfigProvider() apiserver.RestConfigProvider {
	<-d.ready
	return d.restCfgProvider
}
