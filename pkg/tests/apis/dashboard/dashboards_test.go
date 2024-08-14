package dashboards

import (
	"context"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var gvr = schema.GroupVersionResource{
	Group:    "dashboard.grafana.app",
	Version:  "v0alpha1",
	Resource: "dashboards",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationRequiresDevMode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true, // should fail
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	_, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion("dashboard.grafana.app/v0alpha1")
	require.Error(t, err)
}

func TestIntegrationDashboardsApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})
	_, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion("dashboard.grafana.app/v0alpha1")
	require.NoError(t, err)

	t.Run("simple crud+list", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		rsp, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items)

		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title": "Test empty dashboard",
				},
			},
		}
		obj.SetGenerateName("aa")
		obj, err = client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		created := obj.GetName()
		require.True(t, strings.HasPrefix(created, "aa"), "expecting prefix %s (%s)", "aa", created) // the generate name prefix

		// The new value exists in a list
		rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, rsp.Items, 1)
		require.Equal(t, created, rsp.Items[0].GetName())

		// Same value returned from get
		obj, err = client.Resource.Get(ctx, created, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, created, obj.GetName())

		// Commented out because the dynamic client does not like lists as sub-resource
		// // Check that it now appears in the history
		// sub, err := client.Resource.Get(ctx, created, metav1.GetOptions{}, "history")
		// require.NoError(t, err)
		// history, err := sub.ToList()
		// require.NoError(t, err)
		// require.Len(t, history.Items, 1)
		// require.Equal(t, created, history.Items[0].GetName())

		// Delete the object
		err = client.Resource.Delete(ctx, created, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Now it is not in the list
		rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items)
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.GetGroupVersionInfoJSON("dashboard.grafana.app")
		// fmt.Printf("%s", string(disco))

		require.JSONEq(t, `[
  {
    "freshness": "Current",
    "resources": [
      {
        "resource": "dashboards",
        "responseKind": {
          "group": "",
          "kind": "Dashboard",
          "version": ""
        },
        "scope": "Namespaced",
        "singularResource": "dashboard",
        "subresources": [
          {
            "responseKind": {
              "group": "",
              "kind": "DashboardWithAccessInfo",
              "version": ""
            },
            "subresource": "dto",
            "verbs": [
              "get"
            ]
          },
          {
            "responseKind": {
              "group": "",
              "kind": "PartialObjectMetadataList",
              "version": ""
            },
            "subresource": "history",
            "verbs": [
              "get"
            ]
          }
        ],
        "verbs": [
          "create",
          "delete",
          "deletecollection",
          "get",
          "list",
          "patch",
          "update",
          "watch"
        ]
      }
    ],
    "version": "v0alpha1"
  }
]`, disco)
	})
}
