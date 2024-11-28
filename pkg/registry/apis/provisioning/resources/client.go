package resources

import (
	"context"
	"errors"
	"sync"

	folder "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

var ErrNoNamespace = errors.New("no namespace was given")

type ClientFactory struct {
	identities auth.BackgroundIdentityService
	clients    map[string]namespacedClients
	clientsMu  sync.Mutex
}

type namespacedClients struct {
	client *DynamicClient
	kinds  *KindsLookup
}

func NewFactory(identities auth.BackgroundIdentityService) *ClientFactory {
	return &ClientFactory{
		identities: identities,
		clients:    make(map[string]namespacedClients),
	}
}

// New creates a client (or fetches a cached one) to create interfaces into resources.
// The KindsLookup returned can be used to get a resource from a group, version, and kind.
//
// An empty namespace returns ErrNoNamespace. A namespace is always required.
func (c *ClientFactory) New(ns string) (*DynamicClient, *KindsLookup, error) {
	if ns == "" {
		return nil, nil, ErrNoNamespace
	}

	c.clientsMu.Lock()
	defer c.clientsMu.Unlock()

	nsClients, ok := c.clients[ns]
	if ok {
		return nsClients.client, nsClients.kinds, nil
	}

	// TODO: Do we ever want to use another context? Document findings.
	config, err := c.identities.RestConfigForNamespace(context.Background(), ns)
	if err != nil {
		return nil, nil, err
	}

	client, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, nil, err
	}
	nsClients = namespacedClients{
		client: &DynamicClient{inner: client, namespace: ns},
		kinds: &KindsLookup{
			client: client,
			kinds:  make(map[schema.GroupVersionKind]schema.GroupVersionResource),
		},
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
	return c.inner.Resource(resource).Namespace(c.namespace)
}

type KindsLookup struct {
	client *dynamic.DynamicClient
	kinds  map[schema.GroupVersionKind]schema.GroupVersionResource
	kindMu sync.Mutex
}

func (c *KindsLookup) Resource(gvk schema.GroupVersionKind) (schema.GroupVersionResource, bool) {
	c.kindMu.Lock()
	defer c.kindMu.Unlock()

	gvr, ok := c.kinds[gvk]
	if !ok {
		ok = true
		switch gvk.Kind {
		case "Dashboard":
			gvr = gvk.GroupVersion().WithResource("dashboards")
		case "Playlist":
			gvr = gvk.GroupVersion().WithResource("playlists")
		case "Folder":
			gvr = gvk.GroupVersion().WithResource(folder.RESOURCE)
		default:
			ok = false
		}
		// TODO... use the client to get the resource!
		if ok {
			c.kinds[gvk] = gvr
		}
	}

	return gvr, ok
}
