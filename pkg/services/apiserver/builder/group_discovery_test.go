package builder

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/discovery"
	"k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
)

type recordingGroupManager struct {
	discovery.GroupManager
	added []metav1.APIGroup
}

func (m *recordingGroupManager) AddGroup(g metav1.APIGroup) { m.added = append(m.added, g) }

// A group version served only by custom routes must still appear in /apis, or
// the router, which learns the embedded server's groups from there, drops it.
func TestAddGroupDiscovery_ListsRouteOnlyGroupVersion(t *testing.T) {
	container := newContainer()
	var reached string
	err := AugmentWebServicesWithCustomRoutes(container, nil, nil, enabledConfig(testGV),
		GroupVersionRoutes{
			GroupVersion: testGV,
			Routes:       &APIRoutes{Namespace: []APIRouteHandler{postRoute("global/search", &reached, "Search")}},
		})
	require.NoError(t, err)

	groups := &recordingGroupManager{}
	aggregatedGroups := aggregated.NewResourceManager("apis")
	AddGroupDiscovery(container, groups, aggregatedGroups, ProvideCodecFactory(ProvideScheme()), testGV)

	t.Run("aggregated discovery", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/apis", nil)
		req.Header.Set("Accept", "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList")
		rec := httptest.NewRecorder()
		aggregatedGroups.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code)

		var list apidiscoveryv2.APIGroupDiscoveryList
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
		require.Len(t, list.Items, 1)
		assert.Equal(t, testGV.Group, list.Items[0].Name)
		require.Len(t, list.Items[0].Versions, 1)
		assert.Equal(t, testGV.Version, list.Items[0].Versions[0].Version)
	})

	t.Run("legacy discovery", func(t *testing.T) {
		require.Len(t, groups.added, 1)
		assert.Equal(t, testGV.Group, groups.added[0].Name)
		assert.Equal(t, testGV.String(), groups.added[0].PreferredVersion.GroupVersion)
	})

	t.Run("group and version documents", func(t *testing.T) {
		assert.Equal(t, http.StatusOK, dispatch(t, container, http.MethodGet, "/apis/"+testGV.Group))
		assert.Equal(t, http.StatusOK, dispatch(t, container, http.MethodGet, "/apis/"+testGV.String()))
	})

	t.Run("routes are not shadowed", func(t *testing.T) {
		code := dispatch(t, container, http.MethodPost, "/apis/"+testGV.String()+"/namespaces/default/global/search")
		assert.Equal(t, http.StatusOK, code)
		assert.Equal(t, "Search", reached)
	})
}
