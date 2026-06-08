package resources

import (
	"context"
	"fmt"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	iam "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

// Dashboard and Folder GVR/GVK values are re-exported from
// apps/provisioning/pkg/resources so there is a single source of truth.
// User lives here because pkg/registry/apis/provisioning is the only caller.
var (
	UserResource              = iam.UserResourceInfo.GroupVersionResource()
	FolderResource            = provisioningresources.FolderResource
	FolderKind                = provisioningresources.FolderKind
	DashboardResource         = provisioningresources.DashboardResource
	DashboardKind             = provisioningresources.DashboardKind
	DashboardResourceV2       = provisioningresources.DashboardResourceV2
	DashboardResourceV2alpha1 = provisioningresources.DashboardResourceV2alpha1
	DashboardResourceV2beta1  = provisioningresources.DashboardResourceV2beta1

	// SupportedProvisioningResources is the list of resources that can fully managed from the UI
	SupportedProvisioningResources = []schema.GroupVersionResource{FolderResource, DashboardResource}

	// SupportsFolderAnnotation is the list of resources that can be saved in a folder
	SupportsFolderAnnotation = []schema.GroupResource{FolderResource.GroupResource(), DashboardResource.GroupResource()}
)

// folderGVR builds the GVR for the folder API at the given version.
func folderGVR(folderAPIVersion string) schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    FolderResource.Group,
		Version:  folderAPIVersion,
		Resource: FolderResource.Resource,
	}
}

// FolderGVKForVersion returns a GVK for the folder API at the given version.
func FolderGVKForVersion(version string) schema.GroupVersionKind {
	return schema.GroupVersionKind{
		Group:   FolderKind.Group,
		Version: version,
		Kind:    FolderKind.Kind,
	}
}

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
	// Folder returns a dynamic client for the folder API at the given version.
	Folder(ctx context.Context, folderAPIVersion string) (dynamic.ResourceInterface, schema.GroupVersionKind, error)
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
	baseClient := dynamic.Resource(gvr).Namespace(c.namespace)
	info = &clientInfo{
		gvk:    gvk,
		gvr:    gvr,
		client: newRetryResourceInterface(baseClient, defaultRetryBackoff()),
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
			return nil, schema.GroupVersionKind{}, fmt.Errorf("getting preferred version for %s: %w", versionless.String(), err)
		}

		info, ok := c.byResource[gvr]
		if ok && info.client != nil {
			c.byResource[versionless] = info
			return info.client, info.gvk, nil
		}
	} else {
		gvk, err = discovery.GetKindForResource(gvr)
		if err != nil {
			return nil, schema.GroupVersionKind{}, fmt.Errorf("getting kind for resource for %s: %w", gvr.String(), err)
		}
	}
	baseClient := dynamic.Resource(gvr).Namespace(c.namespace)
	info = &clientInfo{
		gvk:    gvk,
		gvr:    gvr,
		client: newRetryResourceInterface(baseClient, defaultRetryBackoff()),
	}
	c.byKind[gvk] = info
	c.byResource[gvr] = info
	if versionless.Group != "" {
		c.byResource[versionless] = info
	}
	return info.client, info.gvk, nil
}

func (c *resourceClients) Folder(ctx context.Context, folderAPIVersion string) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	return c.ForResource(ctx, folderGVR(folderAPIVersion))
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

func (c *multiResourceClients) Folder(ctx context.Context, folderAPIVersion string) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	return c.ForResource(ctx, folderGVR(folderAPIVersion))
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
