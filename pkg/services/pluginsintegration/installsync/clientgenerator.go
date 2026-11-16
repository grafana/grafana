package installsync

import (
	"context"
	"net/http"
	"sync"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/services/apiserver"
)

// ClientGenerator is the client generator used only by plugin install sync.
type ClientGenerator interface {
	resource.ClientGenerator
}

// ProvideClientGenerator creates a lazy client generator whose write requests
// are attributed to plugin install sync through their Kubernetes field manager.
func ProvideClientGenerator(restConfigProvider apiserver.RestConfigProvider) ClientGenerator {
	return &clientGenerator{restConfigProvider: restConfigProvider}
}

type clientGenerator struct {
	restConfigProvider apiserver.RestConfigProvider
	clientGenerator    resource.ClientGenerator
	initOnce           sync.Once
	initError          error
}

func (g *clientGenerator) init() error {
	g.initOnce.Do(func() {
		restConfig, err := g.restConfigProvider.GetRestConfig(context.Background())
		if err != nil {
			g.initError = err
			return
		}
		config := clientrest.CopyConfig(restConfig)
		config.APIPath = "apis"
		config.Wrap(func(next http.RoundTripper) http.RoundTripper {
			return fieldManagerRoundTripper{next: next}
		})
		g.clientGenerator = k8s.NewClientRegistry(*config, k8s.DefaultClientConfig())
	})
	return g.initError
}

func (g *clientGenerator) ClientFor(kind resource.Kind) (resource.Client, error) {
	if err := g.init(); err != nil {
		return nil, err
	}
	return g.clientGenerator.ClientFor(kind)
}

func (g *clientGenerator) GetCustomRouteClient(gv schema.GroupVersion, plural string) (resource.CustomRouteClient, error) {
	if err := g.init(); err != nil {
		return nil, err
	}
	return g.clientGenerator.GetCustomRouteClient(gv, plural)
}

func (g *clientGenerator) DiscoveryClient() (resource.DiscoveryClient, error) {
	if err := g.init(); err != nil {
		return nil, err
	}
	return g.clientGenerator.DiscoveryClient()
}

type fieldManagerRoundTripper struct {
	next http.RoundTripper
}

func (t fieldManagerRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.Method == http.MethodPost || req.Method == http.MethodPut || req.Method == http.MethodPatch {
		req = req.Clone(req.Context())
		query := req.URL.Query()
		query.Set("fieldManager", install.PluginStoreSyncServiceIdentity)
		req.URL.RawQuery = query.Encode()
	}
	return t.next.RoundTrip(req)
}
