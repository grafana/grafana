package provisioning

import (
	"context"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
)

type resourceClient struct {
	identities auth.BackgroundIdentityService
	client     map[string]*dynamic.DynamicClient
	clientMu   sync.Mutex
}

func newResourceClient(identities auth.BackgroundIdentityService) *resourceClient {
	return &resourceClient{
		identities: identities,
		client:     make(map[string]*dynamic.DynamicClient),
	}
}

func (c *resourceClient) Client(ns string) (*dynamic.DynamicClient, error) {
	c.clientMu.Lock()
	defer c.clientMu.Unlock()

	client, ok := c.client[ns]
	if ok {
		return client, nil
	}

	config, err := c.identities.RestConfigForNamespace(context.Background(), ns)
	if err != nil {
		return nil, err
	}

	client, err = dynamic.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	c.client[ns] = client
	return client, nil
}

type kindsLookup struct {
	client *dynamic.DynamicClient
	kinds  map[schema.GroupVersionKind]schema.GroupVersionResource
	kindMu sync.Mutex
}

func newKindsLookup(client *dynamic.DynamicClient) *kindsLookup {
	return &kindsLookup{
		client: client,
		kinds:  make(map[schema.GroupVersionKind]schema.GroupVersionResource),
	}
}

func (c *kindsLookup) Resource(gvk schema.GroupVersionKind) (schema.GroupVersionResource, bool) {
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
		default:
			ok = false
		}
		// TODO... use the client to get the resource!
	}

	return gvr, ok
}
