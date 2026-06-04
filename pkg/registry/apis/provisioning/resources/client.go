package resources

import (
	"context"
	"fmt"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iam "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

// Dashboard GVR/GVK values are re-exported from apps/provisioning/pkg/resources
// so there is a single source of truth. Folder and User live here because
// pkg/registry/apis/provisioning is the only caller for those.
var (
	UserResource              = iam.UserResourceInfo.GroupVersionResource()
	FolderResource            = folders.FolderResourceInfo.GroupVersionResource()
	FolderKind                = folders.FolderResourceInfo.GroupVersionKind()
	DashboardResource         = provisioningresources.DashboardResource
	DashboardKind             = provisioningresources.DashboardKind
	DashboardResourceV2       = provisioningresources.DashboardResourceV2
	DashboardResourceV2alpha1 = provisioningresources.DashboardResourceV2alpha1
	DashboardResourceV2beta1  = provisioningresources.DashboardResourceV2beta1

	// SupportedProvisioningResources is the static set of resources that can be fully
	// managed from the UI. Extra resources (e.g. flag-gated ones) are registered with
	// the client factory and appended to this base set.
	SupportedProvisioningResources = []SupportedResource{
		{GVR: FolderResource, SupportsFolderAnnotation: true},
		{GVR: DashboardResource, SupportsFolderAnnotation: true},
	}
)

// SupportedResource describes a resource that can be managed through provisioning.
// It is the unit of registration: extra resources (e.g. ones gated behind a feature
// flag) are registered with the client factory and merged into the static base set.
type SupportedResource struct {
	// GVR is the resource added to the supported set.
	GVR schema.GroupVersionResource
	// SupportsFolderAnnotation reports whether the resource can be saved in a folder,
	// i.e. whether it should carry the folder header annotation when written.
	SupportsFolderAnnotation bool
}

// supportsFolderAnnotation reports whether gvr is a supported resource that carries the
// folder header annotation when written.
func supportsFolderAnnotation(supported []SupportedResource, gvr schema.GroupVersionResource) bool {
	gr := gvr.GroupResource()
	for _, r := range supported {
		if r.SupportsFolderAnnotation && r.GVR.GroupResource() == gr {
			return true
		}
	}
	return false
}

// provisioningResourcesByName maps the short names accepted in the [provisioning]
// resources / folder_resources config to their GroupVersionResource. The version is
// resolved at runtime by the discovery client when a resource client is requested, so
// the value here only needs to identify the group and resource.
var provisioningResourcesByName = map[string]schema.GroupVersionResource{
	"dashboards": DashboardResource,
	"folders":    FolderResource,
}

// BuildSupportedResources builds the effective supported set from the configured
// resource names. folderResourceNames is the subset of resourceNames that is
// folder-contained (carries the folder header annotation). Unknown names are rejected
// so a misconfiguration fails fast at startup rather than silently dropping a resource.
func BuildSupportedResources(resourceNames, folderResourceNames []string) ([]SupportedResource, error) {
	supportsFolder := make(map[string]bool, len(folderResourceNames))
	for _, name := range folderResourceNames {
		if _, ok := provisioningResourcesByName[name]; !ok {
			return nil, fmt.Errorf("unknown provisioning folder resource %q", name)
		}
		supportsFolder[name] = true
	}

	out := make([]SupportedResource, 0, len(resourceNames))
	for _, name := range resourceNames {
		gvr, ok := provisioningResourcesByName[name]
		if !ok {
			return nil, fmt.Errorf("unknown provisioning resource %q", name)
		}
		out = append(out, SupportedResource{GVR: gvr, SupportsFolderAnnotation: supportsFolder[name]})
	}
	return out, nil
}

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
	// supportedResources is the merged base + registered set, computed once.
	supportedResources []SupportedResource
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
	// SupportedResources returns the resources that can be fully managed from the UI:
	// the static base set plus any extra resources registered with the client factory.
	// Each entry carries whether the resource supports the folder header annotation.
	SupportedResources() []SupportedResource
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

// NewClientFactory creates a ClientFactory. The supported set is the effective list of
// resources that can be managed from the UI, built from configuration (see
// BuildSupportedResources). When none is provided it falls back to the static
// SupportedProvisioningResources base set.
func NewClientFactory(configProvider apiserver.RestConfigProvider, supported ...SupportedResource) ClientFactory {
	return &clientFactory{
		clientsProvider:    newSingleAPIClients(configProvider),
		supportedResources: defaultSupportedResources(supported),
	}
}

// NewClientFactoryForMultipleAPIServers creates a ClientFactory for multiple API servers.
// The supported set behaves as described on NewClientFactory.
func NewClientFactoryForMultipleAPIServers(configProviders map[string]apiserver.RestConfigProvider, supported ...SupportedResource) ClientFactory {
	clientFactories := make(map[string]ClientFactory)

	for api, configProvider := range configProviders {
		clientFactory := NewClientFactory(configProvider, supported...)
		clientFactories[api] = clientFactory
	}

	return &multiClientFactory{clientFactories: clientFactories, supportedResources: defaultSupportedResources(supported)}
}

// defaultSupportedResources returns supported when non-empty, otherwise the static base set.
func defaultSupportedResources(supported []SupportedResource) []SupportedResource {
	if len(supported) == 0 {
		return SupportedProvisioningResources
	}
	return supported
}

type multiClientFactory struct {
	clientFactories map[string]ClientFactory
	// supportedResources is the merged base + registered set, computed once.
	supportedResources []SupportedResource
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
		supportedResources:        m.supportedResources,
	}, nil
}

func (f *clientFactory) Clients(ctx context.Context, namespace string) (ResourceClients, error) {
	return &resourceClients{
		namespace:          namespace,
		clientsProvider:    f.clientsProvider,
		supportedResources: f.supportedResources,
		byKind:             make(map[schema.GroupVersionKind]*clientInfo),
		byResource:         make(map[schema.GroupVersionResource]*clientInfo),
	}, nil
}

type resourceClients struct {
	namespace          string
	clientsProvider    clientsProvider
	supportedResources []SupportedResource

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

func (c *resourceClients) SupportedResources() []SupportedResource {
	return c.supportedResources
}

type multiResourceClients struct {
	namespace                 string
	mutex                     sync.Mutex
	resourceClientsByAPIGroup map[string]ResourceClients
	supportedResources        []SupportedResource
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

func (c *multiResourceClients) SupportedResources() []SupportedResource {
	return c.supportedResources
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
