package unifiedstorageimpl

import (
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type ClientRegistry struct {
	client resource.ResourceClient
	ready  chan struct{}
}

func ProvideUnifiedStorageClientRegistry() *ClientRegistry {
	return &ClientRegistry{
		ready: make(chan struct{}),
	}
}

func (r *ClientRegistry) RegisterClient(c resource.ResourceClient) {
	r.client = c
	close(r.ready)
}

func (r *ClientRegistry) GetClient() resource.ResourceClient {
	<-r.ready
	return r.client
}
