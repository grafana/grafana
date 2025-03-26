package resources

import (
	"context"
	"fmt"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

type ClientFactory struct {
	configProvider apiserver.RestConfigProvider
}

func NewClientFactory(configProvider apiserver.RestConfigProvider) *ClientFactory {
	return &ClientFactory{configProvider}
}

func (f *ClientFactory) Clients(ctx context.Context, namespace string) (*ResourceClients, error) {
	restConfig, err := f.configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, err
	}

	if namespace == "" {
		return nil, fmt.Errorf("missing namespace")
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

	var err error
	var gvk schema.GroupVersionKind
	var versionless schema.GroupVersionResource
	if gvr.Version == "" {
		versionless = gvr
		gvr, gvk, err = c.discovery.GetPreferredVesion(schema.GroupResource{
			Group:    gvr.Group,
			Resource: gvr.Resource,
		})
		if err != nil {
			return nil, schema.GroupVersionKind{}, err
		}

		info, ok := c.byResource[gvr]
		if ok && info.client != nil {
			c.byResource[versionless] = info
			return info.client, info.gvk, nil
		}
	} else {
		gvk, err = c.discovery.GetKindForResource(gvr)
		if err != nil {
			return nil, schema.GroupVersionKind{}, err
		}
	}
	info = &clientInfo{
		gvk:    gvk,
		gvr:    gvr,
		client: c.dynamic.Resource(gvr).Namespace(c.namespace),
	}
	c.byKind[gvk] = info
	c.byResource[gvr] = info
	if versionless.Group != "" {
		c.byResource[versionless] = info
	}
	return info.client, info.gvk, nil
}

func (c *ResourceClients) Folder() (dynamic.ResourceInterface, error) {
	v, _, err := c.ForResource(schema.GroupVersionResource{
		Group:    folders.GROUP,
		Version:  folders.VERSION,
		Resource: folders.RESOURCE,
	})
	return v, err
}

func (c *ResourceClients) User() (dynamic.ResourceInterface, error) {
	v, _, err := c.ForResource(schema.GroupVersionResource{
		Group:    iam.GROUP,
		Version:  iam.VERSION,
		Resource: iam.UserResourceInfo.GroupResource().Resource,
	})
	return v, err
}

func (c *ResourceClients) Dashboard() (dynamic.ResourceInterface, error) {
	v, _, err := c.ForResource(schema.GroupVersionResource{
		Group:    dashboard.GROUP,
		Version:  dashboard.VERSION,
		Resource: dashboard.DASHBOARD_RESOURCE,
	})
	return v, err
}
