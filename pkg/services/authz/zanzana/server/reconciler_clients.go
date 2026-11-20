package server

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

type reconcilerClients struct {
	loopback apiserver.RestConfigProvider
	byGroup  map[string]apiserver.RestConfigProvider
}

func (c reconcilerClients) ForResource(ctx context.Context, namespace string, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
	provider := c.loopback
	if provider == nil {
		provider = c.byGroup[gvr.Group]
	}
	if provider == nil {
		return nil, fmt.Errorf("no client for API group %s", gvr.Group)
	}

	cfg, err := provider.GetRestConfig(ctx)
	if err != nil {
		return nil, err
	}
	discovery, err := client.NewDiscoveryClient(cfg)
	if err != nil {
		return nil, err
	}
	if _, err := discovery.GetKindForResource(gvr); err != nil {
		return nil, err
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}
	return dyn.Resource(gvr).Namespace(namespace), nil
}
