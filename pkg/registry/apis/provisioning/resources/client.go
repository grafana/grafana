package resources

import (
	"context"
	"fmt"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

type ResourceClients struct {
	namespace string

	dynamic   dynamic.Interface
	discovery client.DiscoveryClient

	// ResourceInterface cache for this context + namespace
	mutex      sync.Mutex
	byKind     map[schema.GroupVersionKind]*clientInfo
	byResource map[schema.GroupVersionResource]*clientInfo
}

type clientInfo struct {
	gvk    schema.GroupVersionKind
	gvr    schema.GroupVersionResource
	client dynamic.ResourceInterface
}

func NewResourceClients(ctx context.Context, configProvider apiserver.RestConfigProvider, namespace string) (*ResourceClients, error) {
	if namespace == "" {
		return nil, fmt.Errorf("missing namespace")
	}

	restConfig, err := configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, err
	}

	discovery, err := client.NewDiscoveryClient(restConfig)
	if err != nil {
		return nil, err
	}

	client, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, err
	}

	return &ResourceClients{
		namespace:  namespace,
		discovery:  discovery,
		dynamic:    client,
		byKind:     make(map[schema.GroupVersionKind]*clientInfo),
		byResource: make(map[schema.GroupVersionResource]*clientInfo),
	}, nil
}

func (c *ResourceClients) ForKind(gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	info, ok := c.byKind[gvk]
	if ok && info.client != nil {
		return info.client, info.gvr, nil
	}

	gvr, err := c.discovery.GetResourceForKind(gvk)
	if err != nil {
		return nil, schema.GroupVersionResource{}, err
	}
	info = &clientInfo{
		gvk:    gvk,
		gvr:    gvr,
		client: c.dynamic.Resource(gvr).Namespace(c.namespace),
	}
	c.byKind[gvk] = info
	c.byResource[gvr] = info
	return info.client, info.gvr, nil
}

func (c *ResourceClients) ForResource(gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	info, ok := c.byResource[gvr]
	if ok && info.client != nil {
		return info.client, info.gvk, nil
	}

	gvk, err := c.discovery.GetKindForResource(gvr)
	if err != nil {
		return nil, schema.GroupVersionKind{}, err
	}
	info = &clientInfo{
		gvk:    gvk,
		gvr:    gvr,
		client: c.dynamic.Resource(gvr).Namespace(c.namespace),
	}
	c.byKind[gvk] = info
	c.byResource[gvr] = info
	return info.client, info.gvk, nil
}
