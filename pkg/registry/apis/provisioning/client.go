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

	kinds  map[schema.GroupVersionKind]schema.GroupVersionResource
	kindMu sync.Mutex
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

func (c *resourceClient) GVR(ns string, gvk schema.GroupVersionKind) (schema.GroupVersionResource, bool) {
	c.kindMu.Lock()
	defer c.kindMu.Unlock()

	// TODO... this needs to find the right GVR for a GVK
	ok := true
	var gvr schema.GroupVersionResource
	switch gvk.Kind {
	case "Dashboard":
		gvr = gvk.GroupVersion().WithResource("dashboards")
	case "Playlist":
		gvr = gvk.GroupVersion().WithResource("playlists")
	default:
		ok = false
	}

	return gvr, ok
}
