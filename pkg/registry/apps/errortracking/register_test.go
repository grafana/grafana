package errortracking

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emicklei/go-restful/v3"
	authlib "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/openapi"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/healthz"

	"github.com/stretchr/testify/require"
)

type routeOnlyServer struct {
	container *restful.Container
}

func (s *routeOnlyServer) InstallAPIGroup(info *genericapiserver.APIGroupInfo) error {
	for _, gv := range info.PrioritizedVersions {
		service := new(restful.WebService)
		service.Path("/apis/" + gv.String()).Produces(restful.MIME_JSON)
		s.container.Add(service)
	}
	return nil
}

func (s *routeOnlyServer) RegisteredWebServices() []*restful.WebService {
	return s.container.RegisteredWebServices()
}

func (s *routeOnlyServer) AddReadyzChecks(...healthz.HealthChecker) error { return nil }

func TestRouteOnlyInstallerPublishesVersionDiscovery(t *testing.T) {
	installer, err := RegisterAppInstaller(nil, authlib.FixedAccessClient(true), nil)
	require.NoError(t, err)

	server := &routeOnlyServer{container: restful.NewContainer()}
	require.NoError(t, installer.InstallAPIs(server, nil))

	foundEvents := false
	foundDiscovery := false
	for _, service := range server.RegisteredWebServices() {
		for _, route := range service.Routes() {
			if route.Method == http.MethodPost && strings.HasSuffix(route.Path, "/namespaces/{namespace}/events") {
				foundEvents = true
			}
			if route.Method == http.MethodGet && strings.TrimSuffix(route.Path, "/") == "/apis/error-tracking.grafana.app/v0alpha1" {
				foundDiscovery = true
				_, _, err := openapi.GetOperationIDAndTags(&route)
				require.NoError(t, err, "discovery route must be accepted by Kubernetes OpenAPI generation")
				require.IsType(t, metav1.APIResourceList{}, route.WriteSample)
			}
		}
	}
	require.True(t, foundEvents, "existing event route was not installed")
	require.True(t, foundDiscovery, "version discovery route was not installed")

	httpServer := httptest.NewServer(server.container)
	t.Cleanup(httpServer.Close)
	response, err := http.Get(httpServer.URL + "/apis/error-tracking.grafana.app/v0alpha1")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, response.Body.Close()) })
	require.Equal(t, http.StatusOK, response.StatusCode)

	var resources metav1.APIResourceList
	require.NoError(t, json.NewDecoder(response.Body).Decode(&resources))
	require.Equal(t, metav1.TypeMeta{Kind: "APIResourceList", APIVersion: "v1"}, resources.TypeMeta)
	require.Equal(t, schema.GroupVersion{Group: "error-tracking.grafana.app", Version: "v0alpha1"}.String(), resources.GroupVersion)
	require.Empty(t, resources.APIResources)
}
