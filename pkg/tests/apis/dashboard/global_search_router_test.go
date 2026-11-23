package dashboards

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	searchV0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// search.grafana.app has routes but no resources. The router builds its
// routing table from aggregated discovery, so the group has to be listed there
// or the router answers 404 for its routes.
func TestIntegrationGlobalSearchWithRouterMiddleware(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		EnableGlobalSearch:   true,
		EnableFeatureToggles: []string{featuremgmt.FlagGrafanaUseRouterMiddleware},
	})
	t.Cleanup(helper.Shutdown)

	t.Run("listed in aggregated discovery", func(t *testing.T) {
		info, err := helper.GetGroupVersionInfoJSON(searchV0.GROUP)
		require.NoError(t, err)
		require.Contains(t, info, searchV0.VERSION)
	})

	t.Run("served by the router", func(t *testing.T) {
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			status := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Admin,
				Path: "/apis/discovery/v1alpha2/status",
			}, &struct {
				Ready  bool `json:"ready"`
				Groups []struct {
					Group string `json:"group"`
				} `json:"groups"`
			}{})
			if !assert.Equal(c, http.StatusOK, status.Response.StatusCode) || !assert.True(c, status.Result.Ready) {
				return
			}
			groups := make([]string, 0, len(status.Result.Groups))
			for _, g := range status.Result.Groups {
				groups = append(groups, g.Group)
			}
			assert.Contains(c, groups, searchV0.GROUP)
		}, 30*time.Second, 100*time.Millisecond)

		body, err := json.Marshal(searchV0.SearchQuery{TypeMeta: metav1.TypeMeta{
			APIVersion: searchV0.APIVERSION,
			Kind:       searchV0.KindSearchQuery,
		}})
		require.NoError(t, err)
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   fmt.Sprintf("/apis/%s/namespaces/%s/global/search", searchV0.APIVERSION, helper.Org1.Admin.Identity.GetNamespace()),
			Body:   body,
		}, &map[string]any{})
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))
	})
}
