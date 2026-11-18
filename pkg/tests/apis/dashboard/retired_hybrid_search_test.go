package dashboards

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationRetiredDashboardHybridSearchRoute(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, vectorEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("dashboard_vector_search=%t", vectorEnabled), func(t *testing.T) {
			flags := []string{}
			disabledFlags := []string{}
			if vectorEnabled {
				flags = append(flags, featuremgmt.FlagDashboardVectorSearch)
			} else {
				disabledFlags = append(disabledFlags, featuremgmt.FlagDashboardVectorSearch)
			}
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:        true,
				DisableAnonymous:         true,
				APIServerStorageType:     "unified",
				EnableFeatureToggles:     flags,
				DisableFeatureToggles:    disabledFlags,
				EnableGlobalHybridSearch: true,
			})
			defer helper.Shutdown()

			base := fmt.Sprintf("/apis/dashboard.grafana.app/v0alpha1/namespaces/%s/search", helper.Org1.Admin.Identity.GetNamespace())
			old := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Admin, Method: http.MethodGet, Path: base + "/hybrid?query=cpu",
			}, &metav1.Status{})
			require.Equal(t, http.StatusNotFound, old.Response.StatusCode, string(old.Body))

			openapi := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Admin, Path: "/openapi/v3/apis/dashboard.grafana.app/v0alpha1",
			}, &spec3.OpenAPI{})
			require.Equal(t, http.StatusOK, openapi.Response.StatusCode, string(openapi.Body))
			require.NotNil(t, openapi.Result)
			require.NotNil(t, openapi.Result.Paths)
			require.NotContains(t, openapi.Result.Paths.Paths, "/apis/dashboard.grafana.app/v0alpha1/namespaces/{namespace}/search/hybrid")

			postPath := fmt.Sprintf("/apis/dashboard.grafana.app/v0alpha1/namespaces/%s/dashboards/search/hybrid", helper.Org1.Admin.Identity.GetNamespace())
			post := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Admin, Method: http.MethodPost, Path: postPath,
				Body: []byte("{"), ContentType: "application/json",
			}, &metav1.Status{})
			require.Equal(t, http.StatusBadRequest, post.Response.StatusCode, string(post.Body))
		})
	}
}
