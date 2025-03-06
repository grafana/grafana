package resources

import (
	"context"
	"errors"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
)

var ErrNoNamespace = errors.New("no namespace was given")

type ClientFactory struct {
	configProvider apiserver.RestConfigProvider
	clients        map[string]namespacedClients
	clientsMu      sync.Mutex
}

type namespacedClients struct {
	client *DynamicClient
	kinds  KindsLookup
}

func NewFactory(configProvider apiserver.RestConfigProvider) *ClientFactory {
	return &ClientFactory{
		configProvider: configProvider,
		clients:        make(map[string]namespacedClients),
	}
}

// New creates a client (or fetches a cached one) to create interfaces into resources.
// The KindsLookup returned can be used to get a resource from a group, version, and kind.
//
// An empty namespace returns ErrNoNamespace. A namespace is always required.
func (c *ClientFactory) New(ns string) (*DynamicClient, KindsLookup, error) {
	if ns == "" {
		return nil, nil, ErrNoNamespace
	}

	c.clientsMu.Lock()
	defer c.clientsMu.Unlock()

	nsClients, ok := c.clients[ns]
	if ok {
		return nsClients.client, nsClients.kinds, nil
	}

	ctx, _, err := identity.WithProvisioningIdentitiy(context.Background(), ns)
	if err != nil {
		return nil, nil, err
	}
	config, err := c.configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, nil, err
	}
	client, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, nil, err
	}
	nsClients = namespacedClients{
		client: &DynamicClient{inner: client, namespace: ns},
		kinds:  &StaticKindsLookup{},
	}
	c.clients[ns] = nsClients
	return nsClients.client, nsClients.kinds, nil
}

type DynamicClient struct {
	inner     *dynamic.DynamicClient
	namespace string
}

// GetNamespace returns a copy of the namespace this client was configured with. It will never be mutable.
func (c *DynamicClient) GetNamespace() string {
	return c.namespace
}

// Fetches an interface for the given resource, in the namespace used to create the client.
// The client cannot ever use another namespace. This is done to ensure that no accidental resource leaks occur.
func (c *DynamicClient) Resource(resource schema.GroupVersionResource) dynamic.ResourceInterface {
	if c.inner == nil {
		return nil // this can happen in tests
	}
	return c.inner.Resource(resource).Namespace(c.namespace)
}

type KindsLookup interface {
	Resource(gvk schema.GroupVersionKind) (schema.GroupVersionResource, bool)
}
type StaticKindsLookup struct{}

func (c *StaticKindsLookup) Resource(gvk schema.GroupVersionKind) (schema.GroupVersionResource, bool) {
	switch gvk.Kind {
	case "Dashboard":
		return gvk.GroupVersion().WithResource("dashboards"), true
	case "Playlist":
		return gvk.GroupVersion().WithResource("playlists"), true
	case "Folder":
		return gvk.GroupVersion().WithResource(folder.RESOURCE), true
	default:
	}
	return gvk.GroupVersion().WithResource(""), false
}
