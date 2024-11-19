package provisioning

import (
	"fmt"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

type resourceClient struct {
	//	dyn, err := dynamic.NewForConfig(pk8s.clientConfigProvider.GetDirectRestConfig(c))
	config *rest.Config

	// Good/Bad to reuse client????
	clients map[schema.GroupVersionKind]dynamic.NamespaceableResourceInterface
	mutex   sync.Mutex
}

func newResourceClient(config *rest.Config) *resourceClient {
	return &resourceClient{
		config:  config,
		clients: make(map[schema.GroupVersionKind]dynamic.NamespaceableResourceInterface),
	}
}

func (c *resourceClient) Resource(gvk schema.GroupVersionKind) (dynamic.NamespaceableResourceInterface, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	client, ok := c.clients[gvk]
	if ok {
		return client, nil
	}

	if c.config == nil {
		return nil, fmt.Errorf("missing config")
	}

	apis, err := dynamic.NewForConfig(c.config)
	if err != nil {
		return nil, err
	}

	// TODO, in a real version, we would need to look at `/apis` to discover this mapping
	var gvr schema.GroupVersionResource
	switch gvk.Kind {
	case "Dashboard":
		gvr = gvk.GroupVersion().WithResource("dashboards")
	case "Playlist":
		gvr = gvk.GroupVersion().WithResource("playlists")
	default:
		return nil, fmt.Errorf("unknown Kind: %s", gvk.String())
	}

	client = apis.Resource(gvr)
	c.clients[gvk] = client
	return client, nil
}

// func (pk8s *playlistK8sHandler) getClient(c *contextmodel.ReqContext) (dynamic.ResourceInterface, bool) {
// 	dyn, err := dynamic.NewForConfig(pk8s.clientConfigProvider.GetDirectRestConfig(c))
// 	if err != nil {
// 		c.JsonApiErr(500, "client", err)
// 		return nil, false
// 	}
// 	return dyn.Resource(pk8s.gvr).Namespace(pk8s.namespacer(c.OrgID)), true
// }
