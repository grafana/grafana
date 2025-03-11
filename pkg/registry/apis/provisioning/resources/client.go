package resources

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

type ResoruceClients struct {
	namespace string

	dynamic   dynamic.Interface
	discovery client.DiscoveryClient

	// ResourceInterface cache for this context + namespace
	clients map[schema.GroupVersionKind]dynamic.ResourceInterface
}

func NewResourceClients(ctx context.Context, configProvider apiserver.RestConfigProvider, namespace string) (*ResoruceClients, error) {
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

	return &ResoruceClients{
		namespace: namespace,
		discovery: discovery,
		dynamic:   client,
		clients:   make(map[schema.GroupVersionKind]dynamic.ResourceInterface),
	}, nil
}

func (c *ResoruceClients) Get(gvk schema.GroupVersionKind) (dynamic.ResourceInterface, error) {
	resource, ok := c.clients[gvk]
	if ok && resource != nil {
		return resource, nil
	}

	gvr, err := c.discovery.GetResourceForKind(gvk)
	if err != nil {
		return nil, err
	}

	resource = c.dynamic.Resource(gvr).Namespace(c.namespace)
	c.clients[gvk] = resource
	return resource, nil
}
