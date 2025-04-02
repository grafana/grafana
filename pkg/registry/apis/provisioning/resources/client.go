package resources

import (
	"context"
	"fmt"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

var (
	UserResource      = iam.UserResourceInfo.GroupVersionResource()
	FolderResource    = folders.FolderResourceInfo.GroupVersionResource()
	DashboardResource = dashboard.DashboardResourceInfo.GroupVersionResource()

	// StandardResources is the list of resources that can fully managed from the UI
	StandardResources = []schema.GroupVersionResource{FolderResource, DashboardResource}
)

type ClientFactory struct {
	configProvider apiserver.RestConfigProvider
}

type ResourceClients interface {
	ForKind(gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error)
	ForResource(gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error)

	Folder() (dynamic.ResourceInterface, error)
	User() (dynamic.ResourceInterface, error)
}

func NewClientFactory(configProvider apiserver.RestConfigProvider) *ClientFactory {
	return &ClientFactory{configProvider}
}

func (f *ClientFactory) Clients(ctx context.Context, namespace string) (ResourceClients, error) {
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

	return &resourceClients{
		namespace:  namespace,
		discovery:  discovery,
		dynamic:    client,
		byKind:     make(map[schema.GroupVersionKind]*clientInfo),
		byResource: make(map[schema.GroupVersionResource]*clientInfo),
	}, nil
}

type resourceClients struct {
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

func (c *resourceClients) ForKind(gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
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
func (c *resourceClients) ForResource(gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
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

func (c *resourceClients) Folder() (dynamic.ResourceInterface, error) {
	client, _, err := c.ForResource(FolderResource)
	return client, err
}

func (c *resourceClients) User() (dynamic.ResourceInterface, error) {
	v, _, err := c.ForResource(UserResource)
	return v, err
}

// ForEach applies the function to each resource returned from the list operation
func ForEach(ctx context.Context, client dynamic.ResourceInterface, fn func(item *unstructured.Unstructured) error) error {
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

type dummyClients struct{}
type dummyResourceInterface struct{}

func NewDummyClients() ResourceClients {
	return &dummyClients{}
}

// Folder implements ResourceClients.
func (d *dummyClients) Folder() (dynamic.ResourceInterface, error) {
	return &dummyResourceInterface{}, nil
}

// ForKind implements ResourceClients.
func (d *dummyClients) ForKind(gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
	r := "unknown"
	switch gvk.Kind {
	case "Folder":
		r = "folders"
	case "Dashboard":
		r = "dashboards"
	}
	return &dummyResourceInterface{}, gvk.GroupVersion().WithResource(r), nil
}

// ForResource implements ResourceClients.
func (d *dummyClients) ForResource(gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	k := "unknown"
	switch gvr.Resource {
	case "folders":
		k = "Folder"
	case "dashboards":
		k = "Dashboard"
	}
	return &dummyResourceInterface{}, gvr.GroupVersion().WithKind(k), nil
}

// User implements ResourceClients.
func (d *dummyClients) User() (dynamic.ResourceInterface, error) {
	return &dummyResourceInterface{}, nil
}

// Apply implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) Apply(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

// ApplyStatus implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) ApplyStatus(ctx context.Context, name string, obj *unstructured.Unstructured, options metav1.ApplyOptions) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

// Create implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) Create(ctx context.Context, obj *unstructured.Unstructured, options metav1.CreateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

// Delete implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) Delete(ctx context.Context, name string, options metav1.DeleteOptions, subresources ...string) error {
	return fmt.Errorf("not implemented")
}

// DeleteCollection implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) DeleteCollection(ctx context.Context, options metav1.DeleteOptions, listOptions metav1.ListOptions) error {
	return fmt.Errorf("not implemented")
}

// Get implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) Get(ctx context.Context, name string, options metav1.GetOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

// List implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return nil, fmt.Errorf("not implemented")
}

// Patch implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, options metav1.PatchOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

// Update implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) Update(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

// UpdateStatus implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) UpdateStatus(ctx context.Context, obj *unstructured.Unstructured, options metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, fmt.Errorf("not implemented")
}

// Watch implements dynamic.ResourceInterface.
func (d *dummyResourceInterface) Watch(ctx context.Context, opts metav1.ListOptions) (watch.Interface, error) {
	return nil, fmt.Errorf("not implemented")
}
