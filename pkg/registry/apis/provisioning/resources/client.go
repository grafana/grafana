package resources

import (
	"context"
	"fmt"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iam "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

var (
	UserResource              = iam.UserResourceInfo.GroupVersionResource()
	FolderResource            = folders.FolderResourceInfo.GroupVersionResource()
	DashboardResource         = dashboardV1.DashboardResourceInfo.GroupVersionResource()
	DashboardResourceV2alpha1 = dashboardV2alpha1.DashboardResourceInfo.GroupVersionResource()
	DashboardResourceV2beta1  = dashboardV2beta1.DashboardResourceInfo.GroupVersionResource()

	// SupportedProvisioningResources is the list of resources that can fully managed from the UI
	SupportedProvisioningResources = []schema.GroupVersionResource{FolderResource, DashboardResource}

	// SupportsFolderAnnotation is the list of resources that can be saved in a folder
	SupportsFolderAnnotation = []schema.GroupResource{FolderResource.GroupResource(), DashboardResource.GroupResource()}
)

// ClientFactory is a factory for creating clients for a given namespace
//
//go:generate mockery --name ClientFactory --structname MockClientFactory --inpackage --filename client_factory_mock.go --with-expecter
type ClientFactory interface {
	Clients(ctx context.Context, namespace string) (ResourceClients, error)
}

type clientFactory struct {
	clientsProvider clientsProvider
}

// TODO: Rename to NamespacedClients
// ResourceClients provides access to clients within a namespace
//
//go:generate mockery --name ResourceClients --structname MockResourceClients --inpackage --filename clients_mock.go --with-expecter
type ResourceClients interface {
	ForKind(ctx context.Context, gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error)
	ForResource(ctx context.Context, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error)
	Folder(ctx context.Context) (dynamic.ResourceInterface, error)
	User(ctx context.Context) (dynamic.ResourceInterface, error)
}

type clientsProvider interface {
	GetClientsForKind(ctx context.Context, gvk schema.GroupVersionKind) (dynamic.Interface, client.DiscoveryClient, error)
	GetClientsForResource(ctx context.Context, gvr schema.GroupVersionResource) (dynamic.Interface, client.DiscoveryClient, error)
}

// singleAPIClients provides clients for all registered APIs
// It implements ClientsProvider by creating a dynamic client and discovery client
// for the given rest config provider
type singleAPIClients struct {
	configProvider apiserver.RestConfigProvider
	once           sync.Once
	dynamic        dynamic.Interface
	discovery      client.DiscoveryClient
	initErr        error
}

func newSingleAPIClients(configProvider apiserver.RestConfigProvider) clientsProvider {
	return &singleAPIClients{configProvider: configProvider}
}

func (p *singleAPIClients) onlyOnce(ctx context.Context) error {
	p.once.Do(func() {
		restConfig, e := p.configProvider.GetRestConfig(ctx)
		if e != nil {
			p.initErr = fmt.Errorf("get rest config: %w", e)
			return
		}

		p.dynamic, e = dynamic.NewForConfig(restConfig)
		if e != nil {
			p.initErr = fmt.Errorf("create dynamic client: %w", e)
			return
		}

		p.discovery, e = client.NewDiscoveryClient(restConfig)
		if e != nil {
			p.initErr = fmt.Errorf("create discovery client: %w", e)
			return
		}
	})

	return p.initErr
}

func (p *singleAPIClients) GetClientsForKind(ctx context.Context, _ schema.GroupVersionKind) (dynamic.Interface, client.DiscoveryClient, error) {
	if err := p.onlyOnce(ctx); err != nil {
		return nil, nil, fmt.Errorf("get clients: %w", err)
	}

	return p.dynamic, p.discovery, nil
}

func (p *singleAPIClients) GetClientsForResource(ctx context.Context, _ schema.GroupVersionResource) (dynamic.Interface, client.DiscoveryClient, error) {
	if err := p.onlyOnce(ctx); err != nil {
		return nil, nil, fmt.Errorf("get clients: %w", err)
	}

	return p.dynamic, p.discovery, nil
}

func NewClientFactory(configProvider apiserver.RestConfigProvider) ClientFactory {
	return &clientFactory{newSingleAPIClients(configProvider)}
}

// NewClientFactoryForMultipleAPIServers creates a ClientFactory for multiple API servers
func NewClientFactoryForMultipleAPIServers(configProviders map[string]apiserver.RestConfigProvider) ClientFactory {
	clientFactories := make(map[string]ClientFactory)

	for api, configProvider := range configProviders {
		clientFactory := NewClientFactory(configProvider)
		clientFactories[api] = clientFactory
	}

	return &multiClientFactory{clientFactories: clientFactories}
}

type multiClientFactory struct {
	clientFactories map[string]ClientFactory
}

func (m *multiClientFactory) Clients(ctx context.Context, namespace string) (ResourceClients, error) {
	clients := make(map[string]ResourceClients)
	for group, clientFactory := range m.clientFactories {
		c, err := clientFactory.Clients(ctx, namespace)
		if err != nil {
			return nil, err
		}

		clients[group] = c
	}
	if len(clients) == 0 {
		return nil, fmt.Errorf("no client factories available")
	}

	return &multiResourceClients{
		namespace:                 namespace,
		resourceClientsByAPIGroup: clients,
	}, nil
}

func (f *clientFactory) Clients(ctx context.Context, namespace string) (ResourceClients, error) {
	return &resourceClients{
		namespace:       namespace,
		clientsProvider: f.clientsProvider,
		byKind:          make(map[schema.GroupVersionKind]*clientInfo),
		byResource:      make(map[schema.GroupVersionResource]*clientInfo),
	}, nil
}

type resourceClients struct {
	namespace       string
	clientsProvider clientsProvider

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

// ForKind returns a client for a kind.
// If the kind has a version, it will be used.
// If the kind does not have a version, the preferred version will be used.
func (c *resourceClients) ForKind(ctx context.Context, gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	info, ok := c.byKind[gvk]
	if ok && info.client != nil {
		return info.client, info.gvr, nil
	}

	dynamic, discovery, err := c.clientsProvider.GetClientsForKind(ctx, gvk)
	if err != nil {
		return nil, schema.GroupVersionResource{}, fmt.Errorf("get clients for resource %s: %w", gvk.String(), err)
	}

	var gvr schema.GroupVersionResource
	var versionless schema.GroupVersionKind
	if gvk.Version == "" {
		versionless = gvk
		gvr, gvk, err = discovery.GetPreferredVersionForKind(schema.GroupKind{
			Group: gvk.Group,
			Kind:  gvk.Kind,
		})
		if err != nil {
			return nil, schema.GroupVersionResource{}, err
		}

		info, ok := c.byKind[gvk]
		if ok && info.client != nil {
			c.byKind[versionless] = info
			return info.client, info.gvr, nil
		}
	} else {
		gvr, err = discovery.GetResourceForKind(gvk)
		if err != nil {
			return nil, schema.GroupVersionResource{}, err
		}
	}
	info = &clientInfo{
		gvk:    gvk,
		gvr:    gvr,
		client: dynamic.Resource(gvr).Namespace(c.namespace),
	}
	c.byKind[gvk] = info
	c.byResource[gvr] = info
	if versionless.Group != "" {
		c.byKind[versionless] = info
	}
	return info.client, info.gvr, nil
}

// ForResource returns a client for a resource.
// If the resource has a version, it will be used.
// If the resource does not have a version, the preferred version will be used.
func (c *resourceClients) ForResource(ctx context.Context, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	info, ok := c.byResource[gvr]
	if ok && info.client != nil {
		return info.client, info.gvk, nil
	}

	dynamic, discovery, err := c.clientsProvider.GetClientsForResource(ctx, gvr)
	if err != nil {
		return nil, schema.GroupVersionKind{}, fmt.Errorf("get clients for kind %s: %w", gvr.String(), err)
	}

	var gvk schema.GroupVersionKind
	var versionless schema.GroupVersionResource
	if gvr.Version == "" {
		versionless = gvr
		gvr, gvk, err = discovery.GetPreferredVesion(schema.GroupResource{
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
		gvk, err = discovery.GetKindForResource(gvr)
		if err != nil {
			return nil, schema.GroupVersionKind{}, err
		}
	}
	info = &clientInfo{
		gvk:    gvk,
		gvr:    gvr,
		client: dynamic.Resource(gvr).Namespace(c.namespace),
	}
	c.byKind[gvk] = info
	c.byResource[gvr] = info
	if versionless.Group != "" {
		c.byResource[versionless] = info
	}
	return info.client, info.gvk, nil
}

func (c *resourceClients) Folder(ctx context.Context) (dynamic.ResourceInterface, error) {
	client, _, err := c.ForResource(ctx, FolderResource)
	return client, err
}

func (c *resourceClients) User(ctx context.Context) (dynamic.ResourceInterface, error) {
	v, _, err := c.ForResource(ctx, UserResource)
	return v, err
}

type multiResourceClients struct {
	namespace                 string
	mutex                     sync.Mutex
	resourceClientsByAPIGroup map[string]ResourceClients
}

// ForKind returns a client for a kind.
// If the kind has a version, it will be used.
// If the kind does not have a version, the preferred version will be used.
func (c *multiResourceClients) ForKind(ctx context.Context, gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	resourceClients, ok := c.resourceClientsByAPIGroup[gvk.Group]
	if !ok {
		return nil, schema.GroupVersionResource{}, fmt.Errorf("no clients provider for group %s", gvk.Group)
	}

	return resourceClients.ForKind(ctx, gvk)
}

// ForResource returns a client for a resource.
// If the resource has a version, it will be used.
// If the resource does not have a version, the preferred version will be used.
func (c *multiResourceClients) ForResource(ctx context.Context, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	resourceClients, ok := c.resourceClientsByAPIGroup[gvr.Group]
	if !ok {
		return nil, schema.GroupVersionKind{}, fmt.Errorf("no clients provider for group %s", gvr.Group)
	}

	return resourceClients.ForResource(ctx, gvr)
}

func (c *multiResourceClients) Folder(ctx context.Context) (dynamic.ResourceInterface, error) {
	client, _, err := c.ForResource(ctx, FolderResource)
	return client, err
}

func (c *multiResourceClients) User(ctx context.Context) (dynamic.ResourceInterface, error) {
	v, _, err := c.ForResource(ctx, UserResource)
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
