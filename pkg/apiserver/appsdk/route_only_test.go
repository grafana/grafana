package appsdk

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emicklei/go-restful/v3"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	"k8s.io/apimachinery/pkg/runtime/schema"
	discoveryendpoint "k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
)

func servedDiscovery(t *testing.T, manager discoveryendpoint.ResourceManager) map[string][]string {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/apis", nil)
	req.Header.Set("Accept", "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList")
	rec := httptest.NewRecorder()
	manager.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var list apidiscoveryv2.APIGroupDiscoveryList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	versions := map[string][]string{}
	for _, g := range list.Items {
		for _, v := range g.Versions {
			versions[g.Name] = append(versions[g.Name], v.Version)
		}
	}
	return versions
}

func TestInstallRouteOnlyVersion(t *testing.T) {
	gv := schema.GroupVersion{Group: "live.grafana.app", Version: "v1alpha1"}

	t.Run("adds a web service and a discovery entry", func(t *testing.T) {
		container := restful.NewContainer()
		manager := discoveryendpoint.NewResourceManager("apis")

		installRouteOnlyVersion(container, manager, gv)

		require.Len(t, container.RegisteredWebServices(), 1)
		require.Equal(t, "/apis/live.grafana.app/v1alpha1", container.RegisteredWebServices()[0].RootPath())
		require.Equal(t, map[string][]string{"live.grafana.app": {"v1alpha1"}}, servedDiscovery(t, manager))
	})

	t.Run("reuses an existing web service", func(t *testing.T) {
		container := restful.NewContainer()
		existing := new(restful.WebService)
		existing.Path("/apis/live.grafana.app/v1alpha1")
		container.Add(existing)
		manager := discoveryendpoint.NewResourceManager("apis")

		installRouteOnlyVersion(container, manager, gv)

		require.Len(t, container.RegisteredWebServices(), 1)
		require.Equal(t, map[string][]string{"live.grafana.app": {"v1alpha1"}}, servedDiscovery(t, manager))
	})

	t.Run("nil manager is a no-op", func(t *testing.T) {
		require.NotPanics(t, func() { AdvertiseRouteOnlyVersion(nil, gv) })
	})
}
