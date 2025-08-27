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
)

func TestIntegrationStars(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

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
		stars, err := starsClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, stars.Items, "no stars saved yet")

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
		stars, err = starsClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, stars.Items, 1, "user stars should exist")
		require.Equal(t, stars.Items[0].GetName(),
			starsClient.Args.User.Identity.GetUID(), "star resource for user")
		jj, err := json.MarshalIndent(stars.Items[0].Object["spec"], "", "  ")
		require.NoError(t, err)
		// fmt.Printf("stars: %s\n", string(jj))
		require.JSONEq(t, `{
			"resource": [
				{
					"group": "dashboard.grafana.app",
					"kind": "Dashboard",
					"names": [
						"test-2", 
						"test-3"
					]
				}
			]}`, string(jj))

		// Remove one star
		legacyResponse = apis.DoRequest(helper, apis.RequestParams{
			User:   starsClient.Args.User,
			Method: http.MethodDelete,
			Path:   "/api/user/stars/dashboard/uid/test-3",
		}, &raw)
		require.Equal(t, http.StatusOK, legacyResponse.Response.StatusCode, "removed dashboard star")

		star, err := starsClient.Resource.Get(ctx, starsClient.Args.User.Identity.GetUID(), metav1.GetOptions{})
		require.NoError(t, err)
		jj, err = json.MarshalIndent(star.Object["spec"], "", "  ")
		require.NoError(t, err)
		// fmt.Printf("stars: %s\n", string(jj))
		require.JSONEq(t, `{
			"resource": [
				{
					"group": "dashboard.grafana.app",
					"kind": "Dashboard",
					"names": [
						"test-2"
					]
				}
			]}`, string(jj)) // note that 3 was removed :tada:
	})
}
