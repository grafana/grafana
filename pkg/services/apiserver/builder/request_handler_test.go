package builder

import (
	"net/http"
	"net/http/httptest"
	"testing"

	restful "github.com/emicklei/go-restful/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
)

var testGV = schema.GroupVersion{Group: "example.grafana.app", Version: "v1"}

type routeProviderBuilder struct {
	gv     schema.GroupVersion
	routes *APIRoutes
}

func (b *routeProviderBuilder) GetGroupVersion() schema.GroupVersion { return b.gv }
func (b *routeProviderBuilder) GetAPIRoutes(schema.GroupVersion) *APIRoutes {
	return b.routes
}
func (b *routeProviderBuilder) InstallSchema(*runtime.Scheme) error { return nil }
func (b *routeProviderBuilder) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, APIGroupOptions) error {
	return nil
}
func (b *routeProviderBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
func (b *routeProviderBuilder) AllowedV0Alpha1Resources() []string                  { return nil }

func postRoute(path string, reached *string, name string) APIRouteHandler {
	return APIRouteHandler{
		Path: path,
		Spec: &spec3.PathProps{
			Post: &spec3.Operation{
				OperationProps: spec3.OperationProps{OperationId: "list" + name},
			},
		},
		Handler: func(w http.ResponseWriter, _ *http.Request) {
			*reached = name
			w.WriteHeader(http.StatusOK)
		},
	}
}

// dispatch goes through the container so the assertions cover real routing, not
// the shape of the WebService.
func dispatch(t *testing.T, container *restful.Container, method, path string) int {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	rec := httptest.NewRecorder()
	container.ServeHTTP(rec, req)
	return rec.Code
}

func newContainer() *restful.Container {
	container := restful.NewContainer()
	container.Router(restful.CurlyRouter{})
	return container
}

func enabledConfig(gvs ...schema.GroupVersion) *serverstorage.ResourceConfig {
	cfg := serverstorage.NewResourceConfig()
	cfg.EnableVersions(gvs...)
	return cfg
}

func TestAugmentWebServices_MountsCallerSuppliedRoutes(t *testing.T) {
	container := newContainer()

	var reached string
	err := AugmentWebServicesWithCustomRoutes(container, nil, nil, enabledConfig(testGV),
		GroupVersionRoutes{
			GroupVersion: testGV,
			Routes: &APIRoutes{
				Namespace: []APIRouteHandler{postRoute("widgets/search", &reached, "Search")},
			},
		})
	require.NoError(t, err)

	code := dispatch(t, container, http.MethodPost,
		"/apis/example.grafana.app/v1/namespaces/default/widgets/search")
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "Search", reached, "the caller-supplied handler should have run")
}

// A caller may supply routes for a group version that registered none of its own.
func TestAugmentWebServices_CreatesWebServiceWhenAbsent(t *testing.T) {
	container := newContainer()
	require.Empty(t, container.RegisteredWebServices())

	var reached string
	err := AugmentWebServicesWithCustomRoutes(container, nil, nil, enabledConfig(testGV),
		GroupVersionRoutes{
			GroupVersion: testGV,
			Routes:       &APIRoutes{Namespace: []APIRouteHandler{postRoute("widgets/search", &reached, "Search")}},
		})
	require.NoError(t, err)

	require.Len(t, container.RegisteredWebServices(), 1)
	assert.Equal(t, "/apis/example.grafana.app/v1", container.RegisteredWebServices()[0].RootPath())
}

// Multi-tenant deployments serve one group per process and disable the rest.
func TestAugmentWebServices_SkipsDisabledGroupVersion(t *testing.T) {
	container := newContainer()

	other := schema.GroupVersion{Group: "other.grafana.app", Version: "v1"}
	var reached string
	err := AugmentWebServicesWithCustomRoutes(container, nil, nil, enabledConfig(other),
		GroupVersionRoutes{
			GroupVersion: testGV,
			Routes:       &APIRoutes{Namespace: []APIRouteHandler{postRoute("widgets/search", &reached, "Search")}},
		})
	require.NoError(t, err)

	assert.Empty(t, container.RegisteredWebServices())
	assert.Empty(t, reached)
}

func TestAugmentWebServices_IgnoresEmptyRoutes(t *testing.T) {
	container := newContainer()

	err := AugmentWebServicesWithCustomRoutes(container, nil, nil, enabledConfig(testGV),
		GroupVersionRoutes{GroupVersion: testGV, Routes: nil})
	require.NoError(t, err)
	assert.Empty(t, container.RegisteredWebServices())
}

// A second WebService on the same root path would shadow the first.
func TestAugmentWebServices_SharesWebServiceWithBuilderRoutes(t *testing.T) {
	container := newContainer()

	var builderReached, extraReached string
	b := &routeProviderBuilder{
		gv:     testGV,
		routes: &APIRoutes{Namespace: []APIRouteHandler{postRoute("widgets/existing", &builderReached, "Existing")}},
	}

	err := AugmentWebServicesWithCustomRoutes(container, []APIGroupBuilder{b}, nil, enabledConfig(testGV),
		GroupVersionRoutes{
			GroupVersion: testGV,
			Routes:       &APIRoutes{Namespace: []APIRouteHandler{postRoute("widgets/search", &extraReached, "Search")}},
		})
	require.NoError(t, err)

	require.Len(t, container.RegisteredWebServices(), 1)

	const base = "/apis/example.grafana.app/v1/namespaces/default/widgets/"
	assert.Equal(t, http.StatusOK, dispatch(t, container, http.MethodPost, base+"existing"))
	assert.Equal(t, "Existing", builderReached)
	assert.Equal(t, http.StatusOK, dispatch(t, container, http.MethodPost, base+"search"))
	assert.Equal(t, "Search", extraReached)
}
