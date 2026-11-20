package resources

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	iam "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

// Capabilities a supported resource can declare. Each names the opt-in state; absence is
// the safe default (org-scoped, validated, active). Adding a resource is pure config;
// adding a capability is a new constant plus behaviour wiring.
const (
	// CapabilityFolder marks a folder-scoped resource: it carries the folder annotation on
	// write. Absent means org-scoped.
	CapabilityFolder = "folder"
	// CapabilitySkipValidation skips pipeline/field validation on write. Absent means validated.
	CapabilitySkipValidation = "skipvalidation"
	// CapabilityDisabled marks a resource as declared but not acted on (surfaced, inert).
	// Absent means active.
	CapabilityDisabled = "disabled"
)

// KnownCapabilities is the set of recognised capability tokens; unknown tokens are rejected.
var KnownCapabilities = sets.New(CapabilityFolder, CapabilitySkipValidation, CapabilityDisabled)

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

	// SupportedProvisioningResources is the static fallback set of resources that can be
	// managed from the UI, used when the client factory is created without an explicit
	// (configured) set. The effective set is normally built from configuration; see
	// pkg/setting [provisioning] resources.
	SupportedProvisioningResources = []SupportedResource{
		{GroupKind: FolderKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
		{GroupKind: DashboardKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
	}
)

// SupportedResource describes a resource that can be managed through provisioning. It is
// identified by its group and kind (the API version and plural resource are resolved at
// runtime via discovery) plus a set of capabilities expressed in the negative — absence is
// the safe default.
type SupportedResource struct {
	// GroupKind identifies the resource group and kind.
	schema.GroupKind
	// Capabilities is the set of declared capabilities (see Capability* constants).
	Capabilities sets.Set[string]
	// Collection is the group an expanded member's objects are stored under, empty for a
	// resource that serves its own group. The managed-object index reports a member under it.
	Collection string
	// InProcess serves this kind from inside this process, when set.
	InProcess *InProcessKind
}

// InProcessKind is a kind this process serves itself. Provisioning addresses it through the
// given client instead of the API server, so the kind works on an instance that does not serve
// its group: secure values are stored by a service OSS wires but an API only Enterprise serves.
// Discovery cannot answer for such a group, so the version and plural come with the client.
type InProcessKind struct {
	// GroupVersionResource is the versioned, plural resource the client addresses.
	GroupVersionResource schema.GroupVersionResource
	// Client builds a namespaced client over the in-process service.
	Client InProcessClient
}

// InProcessClient builds a namespaced client for a kind served inside this process. It is the
// shape of the secrets client (registry/apis/secret.SecureValueClient), taken structurally so
// provisioning keeps no dependency on the service behind it.
type InProcessClient interface {
	Client(ctx context.Context, namespace string) (dynamic.ResourceInterface, error)
}

// ServeInProcess marks the declared kind gvk names as served in process, and reports whether it
// was declared at all. A kind nobody declared is left alone: the client would never be reached,
// and the pipeline must not act on a resource the configuration left out.
func ServeInProcess(supported []SupportedResource, gvk schema.GroupVersionKind, gvr schema.GroupVersionResource, client InProcessClient) bool {
	for i, r := range supported {
		if r.GroupKind == gvk.GroupKind() {
			supported[i].InProcess = &InProcessKind{GroupVersionResource: gvr, Client: client}
			return true
		}
	}

	return false
}

// IsActive reports whether the resource is acted on by the pipeline (the default).
func (r SupportedResource) IsActive() bool { return !r.Capabilities.Has(CapabilityDisabled) }

// IsValidated reports whether the resource is validated on write (the default).
func (r SupportedResource) IsValidated() bool { return !r.Capabilities.Has(CapabilitySkipValidation) }

// IsFolderScoped reports whether the resource carries the folder annotation on write.
func (r SupportedResource) IsFolderScoped() bool { return r.Capabilities.Has(CapabilityFolder) }

// ParseSupportedResources parses the shared resource grammar — one entry per resource:
//
//	<group>/<Kind>[:cap[:cap...]]
//
// Group and kind are split on the last "/" (groups contain dots and may be multi-segment). The
// group may name a collection of served groups with a wildcard, optionally qualified
// with the group those are stored under: "*.datasource.grafana.app", "grafana-*@plugins.grafana.app".
// Capabilities are ":"-separated and must be in KnownCapabilities.
// Parsing is strict and fails fast at startup: each entry must be "<group>/<Kind>" with a
// non-empty, dotted group and non-empty kind; capabilities must be known and not repeated; and a
// resource ID must not appear twice. Whitespace is trimmed and empty entries are skipped.
func ParseSupportedResources(entries []string) ([]SupportedResource, error) {
	out := make([]SupportedResource, 0, len(entries))
	seen := sets.New[schema.GroupKind]()
	for _, raw := range entries {
		entry := strings.TrimSpace(raw)
		if entry == "" {
			continue
		}

		parts := strings.Split(entry, ":")
		id := strings.TrimSpace(parts[0])
		slash := strings.LastIndex(id, "/")
		if slash <= 0 || slash == len(id)-1 {
			return nil, fmt.Errorf("invalid provisioning resource %q: expected <group>/<Kind>", entry)
		}
		group, kind := id[:slash], id[slash+1:]
		if err := validateGroup(entry, group); err != nil {
			return nil, err
		}

		gk := schema.GroupKind{Group: group, Kind: kind}
		if seen.Has(gk) {
			return nil, fmt.Errorf("duplicate provisioning resource %q", id)
		}
		seen.Insert(gk)

		caps := sets.New[string]()
		for _, c := range parts[1:] {
			c = strings.TrimSpace(c)
			if !KnownCapabilities.Has(c) {
				return nil, fmt.Errorf("invalid provisioning resource %q: unknown capability %q", entry, c)
			}
			if caps.Has(c) {
				return nil, fmt.Errorf("invalid provisioning resource %q: duplicate capability %q", entry, c)
			}
			caps.Insert(c)
		}

		out = append(out, SupportedResource{GroupKind: gk, Capabilities: caps})
	}
	return out, nil
}

// validateGroup checks a configured group, which may name a collection. A collection whose
// literal part is not a dotted group must name the group its members are stored under.
func validateGroup(entry, group string) error {
	pattern, collection, qualified := strings.Cut(group, provisioningresources.CollectionSeparator)
	// Only the first wildcard is matched against, so a second one is a literal that nothing
	// serves: the collection would silently expand to no members.
	if strings.Count(pattern, provisioningresources.CollectionWildcard) > 1 {
		return fmt.Errorf("invalid provisioning resource %q: collection %q names more than one wildcard", entry, pattern)
	}
	switch {
	case qualified && !provisioningresources.IsCollection(pattern):
		return fmt.Errorf("invalid provisioning resource %q: only a wildcard group names a collection", entry)
	case qualified:
		group = collection
	case provisioningresources.IsCollection(pattern) && !provisioningresources.IsDottedCollection(pattern):
		return fmt.Errorf("invalid provisioning resource %q: wildcard group %q must name the collection its members are stored in, e.g. %s@plugins.grafana.app",
			entry, pattern, pattern)
	default:
		group = provisioningresources.CollectionGroup(pattern)
	}
	if !strings.Contains(group, ".") {
		return fmt.Errorf("invalid provisioning resource %q: group %q must contain a dot", entry, group)
	}
	return nil
}

// supportsFolderAnnotation reports whether gvk is a supported, folder-scoped resource that
// carries the folder header annotation when written.
func supportsFolderAnnotation(supported []SupportedResource, gvk schema.GroupVersionKind) bool {
	gk := gvk.GroupKind()
	for _, r := range supported {
		if r.IsFolderScoped() && r.GroupKind == gk {
			return true
		}
	}
	return false
}

// folderVersionlessGVR builds a versionless GVR for the folder API. The concrete
// version is resolved at runtime via API discovery (the server's preferred version),
// so provisioning works on any instance regardless of which folder versions are enabled.
func folderVersionlessGVR() schema.GroupVersionResource {
	return schema.GroupVersionResource{
		Group:    FolderResource.Group,
		Resource: FolderResource.Resource,
		// Version intentionally empty: resolved via discovery.
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
	// configuredResources may still name collections rather than served groups.
	configuredResources []SupportedResource
	// storageGroup is the group this factory's API server holds, empty for a single server that
	// holds everything. It decides which collections are expanded here.
	storageGroup string
	// expanded caches the result of resolving collections through discovery.
	expandMu sync.Mutex
	expanded []SupportedResource
}

// holds reports whether this factory's API server stores a collection, and so expands it. A
// factory without a storage group is the only server there is, and holds everything.
func (f *clientFactory) holds(collection string) bool {
	return f.storageGroup == "" || f.storageGroup == collection
}

// supportedResources resolves the configured set to served groups, caching the first success: a
// group that starts being served later needs a restart, as installing the plugin does. A failure
// is not cached — a cancelled or timed-out discovery would otherwise break provisioning until
// restart — and the lock makes concurrent callers retry one at a time.
func (f *clientFactory) supportedResources(ctx context.Context) ([]SupportedResource, error) {
	f.expandMu.Lock()
	defer f.expandMu.Unlock()
	if f.expanded != nil {
		return f.expanded, nil
	}
	// Expansion sees the disabled declarations too: a member declared on its own and disabled is
	// excluded even when an active collection covers it. Discovery sees only the active ones, so
	// a failure in a collection nobody acts on cannot fail the expansion.
	active := activeResources(f.configuredResources)
	expanded, err := expandCollections(ctx, discoveryKinds(f.clientsProvider, active, f.holds), f.configuredResources, f.holds)
	if err != nil {
		return nil, err
	}
	f.expanded = activeResources(expanded)
	return f.expanded, nil
}

// TODO: Rename to NamespacedClients
// ResourceClients provides access to clients within a namespace
//
//go:generate mockery --name ResourceClients --structname MockResourceClients --inpackage --filename clients_mock.go --with-expecter
type ResourceClients interface {
	ForKind(ctx context.Context, gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error)
	ForResource(ctx context.Context, gvr schema.GroupVersionResource) (dynamic.ResourceInterface, schema.GroupVersionKind, error)
	// Folder returns a dynamic client for the folder API. The version is resolved
	// via discovery (the server's preferred version); the resolved GVK is returned.
	Folder(ctx context.Context) (dynamic.ResourceInterface, schema.GroupVersionKind, error)
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

		// Wrap the transport with otelhttp so outbound requests carry W3C trace
		// context. Without this the operator's writes to the apiserver (resource
		// creates, folder ensures, job status updates) are leaf spans with no
		// children — the apiserver has no incoming traceparent to continue the
		// trace. The gRPC search path already propagates via its own interceptor.
		// Copy first: GetRestConfig returns a shared config used by other clients.
		restConfig = rest.CopyConfig(restConfig)
		restConfig.Wrap(func(rt http.RoundTripper) http.RoundTripper {
			return otelhttp.NewTransport(rt)
		})

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

// NewClientFactory creates a ClientFactory. The supported set is the configured list of
// resources that can be managed from the UI; the ResourceClients it produces expose only
// the enabled subset via SupportedResources(). When none is provided it falls back to the
// static SupportedProvisioningResources base set.
func NewClientFactory(configProvider apiserver.RestConfigProvider, supported ...SupportedResource) ClientFactory {
	return &clientFactory{
		clientsProvider:     newSingleAPIClients(configProvider),
		configuredResources: defaultSupportedResources(supported),
	}
}

// NewClientFactoryForMultipleAPIServers creates a ClientFactory for multiple API servers.
// The supported set behaves as described on NewClientFactory.
//
// Every server resolves the whole configured set, so precedence between a collection and a member
// declared on its own is resolved the same way wherever it is resolved. Only the server that holds
// a collection expands it: its members reach the merged set from there, and a server that holds no
// collection asks discovery nothing, so its outage cannot fail the clients for other groups.
func NewClientFactoryForMultipleAPIServers(configProviders map[string]apiserver.RestConfigProvider, supported ...SupportedResource) ClientFactory {
	configured := defaultSupportedResources(supported)
	clientFactories := make(map[string]ClientFactory)
	for api, configProvider := range configProviders {
		clientFactories[api] = &clientFactory{
			clientsProvider:     newSingleAPIClients(configProvider),
			configuredResources: configured,
			storageGroup:        api,
		}
	}

	return &multiClientFactory{clientFactories: clientFactories, collections: collectionPatterns(configured)}
}

// activeResources returns only the active resources. Disabled resources are declared (and
// surfaced on the settings endpoint) but are not acted on by the pipeline.
func activeResources(all []SupportedResource) []SupportedResource {
	out := make([]SupportedResource, 0, len(all))
	for _, r := range all {
		if r.IsActive() {
			out = append(out, r)
		}
	}
	return out
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
	// collections are the configured patterns, resolving a member group onto the API server
	// registered for its collection.
	collections []string
}

// collectionPatterns returns the configured groups that name a collection.
func collectionPatterns(configured []SupportedResource) []string {
	out := make([]string, 0, len(configured))
	for _, r := range collectionResources(configured) {
		out = append(out, r.Group)
	}
	return out
}

// collectionResources returns the configured entries whose group names a collection.
func collectionResources(configured []SupportedResource) []SupportedResource {
	out := make([]SupportedResource, 0, len(configured))
	for _, r := range configured {
		if provisioningresources.IsCollection(r.Group) {
			out = append(out, r)
		}
	}
	return out
}

func (m *multiClientFactory) Clients(ctx context.Context, namespace string) (ResourceClients, error) {
	clients := make(map[string]ResourceClients)
	seen := sets.New[schema.GroupKind]()
	var supported []SupportedResource
	for group, clientFactory := range m.clientFactories {
		c, err := clientFactory.Clients(ctx, namespace)
		if err != nil {
			return nil, err
		}

		clients[group] = c
		// A collection is expanded by whichever server actually serves its members.
		for _, r := range c.SupportedResources() {
			if !seen.Has(r.GroupKind) {
				seen.Insert(r.GroupKind)
				supported = append(supported, r)
			}
		}
	}
	if len(clients) == 0 {
		return nil, fmt.Errorf("no client factories available")
	}

	return &multiResourceClients{
		namespace:                 namespace,
		resourceClientsByAPIGroup: clients,
		supportedResources:        supported,
		collections:               m.collections,
	}, nil
}

func (f *clientFactory) Clients(ctx context.Context, namespace string) (ResourceClients, error) {
	supported, err := f.supportedResources(ctx)
	if err != nil {
		return nil, err
	}
	return &resourceClients{
		namespace:          namespace,
		clientsProvider:    f.clientsProvider,
		supportedResources: supported,
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

	served, err := c.inProcess(ctx, func(r SupportedResource) bool {
		return r.GroupKind == gvk.GroupKind() &&
			(gvk.Version == "" || gvk.Version == r.InProcess.GroupVersionResource.Version)
	})
	if err != nil {
		return nil, schema.GroupVersionResource{}, err
	}
	if served != nil {
		return served.client, served.gvr, nil
	}

	dynamic, discovery, err := c.clientsProvider.GetClientsForKind(ctx, gvk)
	if err != nil {
		return nil, schema.GroupVersionResource{}, fmt.Errorf("get clients for resource %s: %w", gvk.String(), err)
	}

	var gvr schema.GroupVersionResource
	var versionless schema.GroupVersionKind
	if gvk.Version == "" {
		versionless = gvk
		gvr, gvk, err = discovery.GetPreferredVersionForKind(ctx, schema.GroupKind{
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
		gvr, err = discovery.GetResourceForKind(ctx, gvk)
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

// inProcess returns the client for the first declared kind this process serves itself that
// matches, nil when none does. matches sees only a kind that has one, so it may read InProcess.
// The caller holds the mutex.
func (c *resourceClients) inProcess(ctx context.Context, matches func(SupportedResource) bool) (*clientInfo, error) {
	for _, r := range c.supportedResources {
		if r.InProcess == nil || !matches(r) {
			continue
		}

		gvr := r.InProcess.GroupVersionResource
		gvk := gvr.GroupVersion().WithKind(r.Kind)
		if info, ok := c.byKind[gvk]; ok && info.client != nil {
			return info, nil
		}

		client, err := r.InProcess.Client.Client(ctx, c.namespace)
		if err != nil {
			return nil, fmt.Errorf("get in-process client for %s: %w", gvk.String(), err)
		}

		info := &clientInfo{gvk: gvk, gvr: gvr, client: client}
		c.byKind[gvk] = info
		c.byKind[gvk.GroupKind().WithVersion("")] = info
		c.byResource[gvr] = info
		c.byResource[gvr.GroupResource().WithVersion("")] = info

		return info, nil
	}

	return nil, nil
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

	served, err := c.inProcess(ctx, func(r SupportedResource) bool {
		declared := r.InProcess.GroupVersionResource
		return declared.Group == gvr.Group && declared.Resource == gvr.Resource &&
			(gvr.Version == "" || gvr.Version == declared.Version)
	})
	if err != nil {
		return nil, schema.GroupVersionKind{}, err
	}
	if served != nil {
		return served.client, served.gvk, nil
	}

	dynamic, discovery, err := c.clientsProvider.GetClientsForResource(ctx, gvr)
	if err != nil {
		return nil, schema.GroupVersionKind{}, fmt.Errorf("get clients for kind %s: %w", gvr.String(), err)
	}

	var gvk schema.GroupVersionKind
	var versionless schema.GroupVersionResource
	if gvr.Version == "" {
		versionless = gvr
		gvr, gvk, err = discovery.GetPreferredVersion(ctx, schema.GroupResource{
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

func (c *resourceClients) Folder(ctx context.Context) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	return c.ForResource(ctx, folderVersionlessGVR())
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
	// collections are the configured collections a member group is resolved through.
	collections []string
}

// ForKind returns a client for a kind.
// If the kind has a version, it will be used.
// If the kind does not have a version, the preferred version will be used.
func (c *multiResourceClients) ForKind(ctx context.Context, gvk schema.GroupVersionKind) (dynamic.ResourceInterface, schema.GroupVersionResource, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	resourceClients, ok := c.clientsFor(gvk.Group)
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

	resourceClients, ok := c.clientsFor(gvr.Group)
	if !ok {
		return nil, schema.GroupVersionKind{}, fmt.Errorf("no clients provider for group %s", gvr.Group)
	}

	return resourceClients.ForResource(ctx, gvr)
}

func (c *multiResourceClients) Folder(ctx context.Context) (dynamic.ResourceInterface, schema.GroupVersionKind, error) {
	return c.ForResource(ctx, folderVersionlessGVR())
}

func (c *multiResourceClients) User(ctx context.Context) (dynamic.ResourceInterface, error) {
	v, _, err := c.ForResource(ctx, UserResource)
	return v, err
}

func (c *multiResourceClients) SupportedResources() []SupportedResource {
	return c.supportedResources
}

// clientsFor resolves the API server serving a group, falling back to the one registered for its
// collection: members are served together and cannot be enumerated up front.
func (c *multiResourceClients) clientsFor(group string) (ResourceClients, bool) {
	if clients, ok := c.resourceClientsByAPIGroup[group]; ok {
		return clients, true
	}
	for _, pattern := range c.collections {
		if !provisioningresources.CoversGroup(pattern, group) {
			continue
		}
		if clients, ok := c.resourceClientsByAPIGroup[provisioningresources.CollectionGroup(pattern)]; ok {
			return clients, true
		}
	}
	return nil, false
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

// nonProvisionableGroups are served groups a collection never expands to: the built-in data sources
// hold no stored instances, so they would add an empty export list and inert settings rows.
var nonProvisionableGroups = sets.New(
	"grafana.datasource.grafana.app",
	"mixed.datasource.grafana.app",
	"dashboard.datasource.grafana.app",
)

// expandCollections turns each configured collection into one entry per API group that serves
// the kind inside it; an entry naming a served group passes through. Discovery is the source
// rather than the installed plugin list: a plugin can be installed without its group being served,
// and it is the served group a client has to address.
func expandCollections(ctx context.Context, listKinds groupKindLister, configured []SupportedResource, holds func(collection string) bool) ([]SupportedResource, error) {
	var served []schema.GroupKind
	var listed bool
	// A collection may cover a group that is also declared on its own, or that another collection
	// covers. The same group and kind twice would be listed twice, and full sync deletes the
	// duplicate as an orphan at the same path. An explicit declaration wins, disabled included.
	emitted := sets.New[schema.GroupKind]()
	for _, r := range configured {
		if !provisioningresources.IsCollection(r.Group) {
			emitted.Insert(r.GroupKind)
		}
	}

	out := make([]SupportedResource, 0, len(configured))
	for _, r := range configured {
		if !provisioningresources.IsCollection(r.Group) {
			// Stored under the collection that holds it, however it was declared: the index
			// counts it there, and the export quota is checked against those counts.
			r.Collection = storingCollection(configured, r.GroupKind)
			out = append(out, r)
			continue
		}
		// A collection nobody acts on is not expanded: its members would be filtered out of the
		// result anyway, and asking discovery for them lets an inert declaration fail the clients
		// every active resource needs. Only a failure inside an active collection is relevant,
		// and a provider or non-ErrGroupDiscoveryFailed error is not filtered at all.
		//
		// A collection another server holds is skipped for the same reason: that server expands
		// it, and its members reach the merged set from there.
		if !r.IsActive() || !holds(provisioningresources.CollectionGroup(r.Group)) {
			continue
		}
		if !listed {
			var err error
			if served, err = listKinds(ctx); err != nil {
				return nil, err
			}
			listed = true
		}
		collection := provisioningresources.CollectionGroup(r.Group)
		for _, gk := range served {
			if gk.Kind != r.Kind || !provisioningresources.CoversGroup(r.Group, gk.Group) || nonProvisionableGroups.Has(gk.Group) {
				continue
			}
			if emitted.Has(gk) {
				continue
			}
			emitted.Insert(gk)
			out = append(out, SupportedResource{GroupKind: gk, Capabilities: r.Capabilities, Collection: collection})
		}
	}
	return out, nil
}

// storingCollection returns the group a declared resource is stored under, when a configured
// collection covers it, and empty when none does.
func storingCollection(configured []SupportedResource, gk schema.GroupKind) string {
	for _, r := range configured {
		if provisioningresources.IsCollection(r.Group) && r.Kind == gk.Kind &&
			provisioningresources.CoversGroup(r.Group, gk.Group) {
			return provisioningresources.CollectionGroup(r.Group)
		}
	}
	return ""
}

// groupKindLister lists the group/kind pairs a server serves.
type groupKindLister func(ctx context.Context) ([]schema.GroupKind, error)

// discoveryKinds lists every kind the server serves. A discovery failure outside the configured
// collections is tolerated; one inside is not, since a member would silently go missing.
func discoveryKinds(provider clientsProvider, configured []SupportedResource, holds func(collection string) bool) groupKindLister {
	// Only a collection expanded here can hide a member. A group declared on its own passes
	// through and resolves (or fails) when a client for it is taken, and a collection another
	// server holds is that server's to report on.
	relevant := func(group string) bool {
		for _, r := range configured {
			if provisioningresources.IsCollection(r.Group) &&
				provisioningresources.CoversGroup(r.Group, group) &&
				holds(provisioningresources.CollectionGroup(r.Group)) {
				return true
			}
		}
		return false
	}

	return func(ctx context.Context) ([]schema.GroupKind, error) {
		_, discoveryClient, err := provider.GetClientsForKind(ctx, schema.GroupVersionKind{})
		if err != nil {
			return nil, fmt.Errorf("get discovery client for collection expansion: %w", err)
		}
		lists, err := discoveryClient.PreferredResources(ctx, relevant)
		if err != nil {
			return nil, fmt.Errorf("list served resources for collection expansion: %w", err)
		}

		seen := sets.New[schema.GroupKind]()
		out := make([]schema.GroupKind, 0, len(lists))
		for _, list := range lists {
			gv, err := schema.ParseGroupVersion(list.GroupVersion)
			if err != nil {
				continue
			}
			for _, served := range list.APIResources {
				// Subresources carry their parent's kind; only the resource itself is addressable.
				if strings.Contains(served.Name, "/") {
					continue
				}
				gk := schema.GroupKind{Group: gv.Group, Kind: served.Kind}
				if !seen.Has(gk) {
					seen.Insert(gk)
					out = append(out, gk)
				}
			}
		}
		return out, nil
	}
}
