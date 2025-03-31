package resources

import (
	"context"
	"fmt"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

// ForResource returns a client for a resource.
// If the resource has a version, it will be used.
// If the resource does not have a version, the preferred version will be used.
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

// ForEachResource applies the function to each resource in the discovery client
func (c *ResourceClients) ForEachResource(ctx context.Context, kind schema.GroupVersionResource, fn func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error) error {
	client, _, err := c.ForResource(kind)
	if err != nil {
		return err
	}

	return ForEachResource(ctx, client, func(item *unstructured.Unstructured) error {
		return fn(client, item)
	})
}

// ForEachResource applies the function to each resource in the discovery client
func ForEachResource(ctx context.Context, client dynamic.ResourceInterface, fn func(item *unstructured.Unstructured) error) error {
	var continueToken string
	for ctx.Err() == nil {
		list, err := client.List(ctx, metav1.ListOptions{Limit: 100, Continue: continueToken})
		if err != nil {
			return fmt.Errorf("error executing list: %w", err)
		}

		for _, item := range list.Items {
			if ctx.Err() != nil {
				return ctx.Err()
			}

			if err := fn(&item); err != nil {
				return err
			}
		}

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return nil
}

// ForEachUnmanagedResource applies the function to each unprovisioned supported resource
func (c *ResourceClients) ForEachUnmanagedResource(ctx context.Context, fn func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error) error {
	return c.ForEachSupportedResource(ctx, func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error {
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return fmt.Errorf("extract meta accessor: %w", err)
		}

		// Skip if managed
		_, ok := meta.GetManagerProperties()
		if ok {
			return nil
		}

		return fn(client, item)
	})
}

// ForEachSupportedResource applies the function to each supported resource
func (c *ResourceClients) ForEachSupportedResource(ctx context.Context, fn func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error) error {
	for _, kind := range SupportedResources {
		if err := c.ForEachResource(ctx, kind, fn); err != nil {
			return err
		}
	}
	return nil
}

func (c *ResourceClients) Folder() (dynamic.ResourceInterface, error) {
	client, _, err := c.ForResource(FolderResource)
	return client, err
}

func (c *ResourceClients) ForEachFolder(ctx context.Context, fn func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error) error {
	return c.ForEachResource(ctx, FolderResource, fn)
}

func (c *ResourceClients) User() (dynamic.ResourceInterface, error) {
	v, _, err := c.ForResource(UserResource)
	return v, err
}

var UserResource = schema.GroupVersionResource{
	Group:    iam.GROUP,
	Version:  iam.VERSION,
	Resource: iam.UserResourceInfo.GroupResource().Resource,
}

var FolderResource = schema.GroupVersionResource{
	Group:    folders.GROUP,
	Version:  folders.VERSION,
	Resource: folders.RESOURCE,
}

var DashboardResource = schema.GroupVersionResource{
	Group:    dashboard.GROUP,
	Version:  dashboard.VERSION,
	Resource: dashboard.DASHBOARD_RESOURCE,
}

// SupportedResources is the list of resources that are supported by provisioning
var SupportedResources = []schema.GroupVersionResource{FolderResource, DashboardResource}
