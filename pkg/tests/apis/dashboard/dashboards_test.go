package dashboards

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
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
		AppModeProduction:    true, // should fail
		DisableAnonymous:     true,
		APIServerStorageType: options.StorageTypeUnified, // tests local unified storage connection
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	_, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion("dashboard.grafana.app/v0alpha1")
	require.Error(t, err)
}

func runDashboardTest(t *testing.T, helper *apis.K8sTestHelper) {
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

		obj.Object["spec"].(map[string]any)["title"] = "Changed title"

		updated, err := client.Resource.Update(context.Background(),
			obj,
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, obj.GetName(), updated.GetName())
		require.Equal(t, obj.GetUID(), updated.GetUID())
		require.Less(t, obj.GetResourceVersion(), updated.GetResourceVersion())

		// Delete the object
		err = client.Resource.Delete(ctx, created, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Now it is not in the list
		rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items)
	})
}

func TestIntegrationDashboardsApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("with dual writer mode 0", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				featuremgmt.FlagKubernetesDashboardsAPI,
				featuremgmt.FlagKubernetesDashboards,
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 0,
				},
			},
		})
		runDashboardTest(t, helper)
	})

	t.Run("with dual writer mode 1", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				featuremgmt.FlagKubernetesDashboardsAPI,
				featuremgmt.FlagKubernetesDashboards,
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 1,
				},
			},
		})
		runDashboardTest(t, helper)
	})

	t.Run("with dual writer mode 2", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				featuremgmt.FlagKubernetesDashboardsAPI,
				featuremgmt.FlagKubernetesDashboards,
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 2,
				},
			},
		})
		runDashboardTest(t, helper)
	})

	t.Run("with dual writer mode 3", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				featuremgmt.FlagKubernetesDashboardsAPI,
				featuremgmt.FlagKubernetesDashboards,
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 3,
				},
			},
		})
		runDashboardTest(t, helper)
	})

	t.Run("with dual writer mode 4", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				featuremgmt.FlagKubernetesDashboardsAPI,
				featuremgmt.FlagKubernetesDashboards,
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 4,
				},
			},
		})
		runDashboardTest(t, helper)
	})

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagKubernetesDashboardsAPI, // Required to start the example service
		},
	})

	_, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion("dashboard.grafana.app/v0alpha1")
	require.NoError(t, err)

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.GetGroupVersionInfoJSON("dashboard.grafana.app")

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
      },
      {
        "resource": "librarypanels",
        "responseKind": {
          "group": "",
          "kind": "LibraryPanel",
          "version": ""
        },
        "scope": "Namespaced",
        "singularResource": "librarypanel",
        "verbs": [
          "get",
          "list"
        ]
      }
    ],
    "version": "v2alpha1"
  },
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
      },
      {
        "resource": "librarypanels",
        "responseKind": {
          "group": "",
          "kind": "LibraryPanel",
          "version": ""
        },
        "scope": "Namespaced",
        "singularResource": "librarypanel",
        "verbs": [
          "get",
          "list"
        ]
      }
    ],
    "version": "v1alpha1"
  },
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
      },
      {
        "resource": "librarypanels",
        "responseKind": {
          "group": "",
          "kind": "LibraryPanel",
          "version": ""
        },
        "scope": "Namespaced",
        "singularResource": "librarypanel",
        "verbs": [
          "get",
          "list"
        ]
      }
    ],
    "version": "v0alpha1"
  }
]`, disco)
	})
}
