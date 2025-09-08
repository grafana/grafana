package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationStars(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})

	t.Run("legacy dashboard stars", func(t *testing.T) {
		ctx := context.Background()
		starsClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  preferences.StarsResourceInfo.GroupVersionResource(),
		})
		dashboardClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashboardV1.DashboardResourceInfo.GroupVersionResource(),
		})

		// Create 5 dashboards
		for i := range 5 {
			_, err := dashboardClient.Resource.Create(context.Background(), &unstructured.Unstructured{
				Object: map[string]any{
					"apiVersion": dashboardV1.DashboardResourceInfo.GroupVersion().String(),
					"kind":       "Dashboard",
					"metadata": map[string]any{
						"name": fmt.Sprintf("test-%d", i),
					},
					"spec": map[string]any{
						"title":         fmt.Sprintf("test %d", i),
						"schemaVersion": 41, // not really!
						"panels":        []any{},
					},
				},
			}, metav1.CreateOptions{})
			require.NoError(t, err)
		}
		found, err := dashboardClient.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, found.Items, 5, "should be 5 dashboards")

		// List is empty when we start
		rsp, err := starsClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items, "no stars saved yet")

		raw := make(map[string]any)
		legacyResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   starsClient.Args.User,
			Method: http.MethodPost,
			Path:   "/api/user/stars/dashboard/uid/test-2",
		}, &raw)
		require.Equal(t, http.StatusOK, legacyResponse.Response.StatusCode, "add dashboard star")
		legacyResponse = apis.DoRequest(helper, apis.RequestParams{
			User:   starsClient.Args.User,
			Method: http.MethodPost,
			Path:   "/api/user/stars/dashboard/uid/test-3",
		}, &raw)
		require.Equal(t, http.StatusOK, legacyResponse.Response.StatusCode, "add dashboard star")

		// List values and compare results
		rsp, err = starsClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		stars := typed(t, rsp, &preferences.StarsList{})

		require.Len(t, stars.Items, 1, "user stars should exist")
		require.Equal(t, "user-"+starsClient.Args.User.Identity.GetIdentifier(),
			stars.Items[0].GetName(), "star resource for user")
		resources := stars.Items[0].Spec.Resource
		require.Len(t, resources, 1)
		require.Equal(t, "dashboard.grafana.app", resources[0].Group)
		require.Equal(t, "Dashboard", resources[0].Kind)
		require.ElementsMatch(t, []string{"test-2", "test-3"}, resources[0].Names)

		// Remove one star
		legacyResponse = apis.DoRequest(helper, apis.RequestParams{
			User:   starsClient.Args.User,
			Method: http.MethodDelete,
			Path:   "/api/user/stars/dashboard/uid/test-3",
		}, &raw)
		require.Equal(t, http.StatusOK, legacyResponse.Response.StatusCode, "removed dashboard star")

		rspObj, err := starsClient.Resource.Get(ctx, "user-"+starsClient.Args.User.Identity.GetIdentifier(), metav1.GetOptions{})
		require.NoError(t, err)

		after := typed(t, rspObj, &preferences.Stars{})
		resources = after.Spec.Resource
		require.Len(t, resources, 1)
		require.Equal(t, "dashboard.grafana.app", resources[0].Group)
		require.Equal(t, "Dashboard", resources[0].Kind)
		require.Equal(t, []string{"test-2"}, resources[0].Names)

		// Change stars via k8s update
		rspObj, err = starsClient.Resource.Update(ctx, &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]any{
					"name":      "user-" + starsClient.Args.User.Identity.GetIdentifier(),
					"namespace": "default",
				},
				"spec": map[string]any{
					"resource": []map[string]any{
						{
							"group": "dashboard.grafana.app",
							"kind":  "Dashboard",
							"names": []string{"test-2", "aaa", "bbb"},
						},
					},
				},
			},
		}, metav1.UpdateOptions{})
		require.NoError(t, err)

		after = typed(t, rspObj, &preferences.Stars{})
		resources = after.Spec.Resource
		require.Len(t, resources, 1)
		require.Equal(t, "dashboard.grafana.app", resources[0].Group)
		require.Equal(t, "Dashboard", resources[0].Kind)
		require.ElementsMatch(t,
			[]string{"test-2", "aaa", "bbb"}, // NOTE 2 stays, 3 removed, added aaa+bbb
			resources[0].Names)
	})
}

func typed[T any](t *testing.T, obj any, out T) T {
	jj, err := json.Marshal(obj)
	require.NoError(t, err)
	err = json.Unmarshal(jj, out)
	require.NoError(t, err)
	return out
}
