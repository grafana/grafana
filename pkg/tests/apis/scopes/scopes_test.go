package scopes

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationScopes(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagScopeApi, // Required to register the API
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()
		resources, err := disco.ServerResourcesForGroupVersion("scope.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)
		//fmt.Printf("%s", string(v1Disco))

		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "scope.grafana.app/v0alpha1",
			"resources": [
			  {
				"name": "scope_dashboard_bindings",
				"singularName": "FindScopeDashboardsResult",
				"namespaced": true,
				"kind": "FindScopeDashboardBindingsResults",
				"verbs": [
				  "get"
				]
			  },
			  {
				"name": "scope_node_children",
				"singularName": "FindScopeNodeChildrenResults",
				"namespaced": true,
				"kind": "FindScopeNodeChildrenResults",
				"verbs": [
				  "get"
				]
			  },
			  {
				"name": "scopedashboardbindings",
				"singularName": "scopedashboardbinding",
				"namespaced": true,
				"kind": "ScopeDashboardBinding",
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
				"name": "scopedashboardbindings/status",
				"singularName": "",
				"namespaced": true,
				"kind": "ScopeDashboardBinding",
				"verbs": [
				  "get",
				  "patch",
				  "update"
				]
			  },
			  {
				"name": "scopenodes",
				"singularName": "scopenode",
				"namespaced": true,
				"kind": "ScopeNode",
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
				"name": "scopes",
				"singularName": "scope",
				"namespaced": true,
				"kind": "Scope",
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
			]
		  }`, string(v1Disco))
	})

	t.Run("Check create and list", func(t *testing.T) {
		// Scope create+get
		scopeClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: "default", // actually org1
			GVR: schema.GroupVersionResource{
				Group: "scope.grafana.app", Version: "v0alpha1", Resource: "scopes",
			},
		})
		createOptions := metav1.CreateOptions{FieldValidation: "Strict"}

		s0, err := scopeClient.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/example-scope.yaml"),
			createOptions,
		)

		require.NoError(t, err)
		require.Equal(t, "example", s0.GetName())
		s1, err := scopeClient.Resource.Get(ctx, "example", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t,
			mustNestedString(s0.Object, "spec", "title"),
			mustNestedString(s1.Object, "spec", "title"),
		)

		_, err = scopeClient.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/example-scope2.yaml"),
			createOptions,
		)
		require.NoError(t, err)

		// Name length test
		scope3 := helper.LoadYAMLOrJSONFile("testdata/example-scope3.yaml")

		// Name too long (>253)
		scope3.SetName(strings.Repeat("0", 254))
		_, err = scopeClient.Resource.Create(ctx,
			scope3,
			createOptions,
		)
		require.Error(t, err)

		// Maximum allowed length for name (253)
		scope3.SetName(strings.Repeat("0", 253))
		_, err = scopeClient.Resource.Create(ctx,
			scope3,
			createOptions,
		)
		require.NoError(t, err)

		// Field Selector test
		found, err := scopeClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.title=foo-scope",
		})
		require.NoError(t, err)
		require.Len(t, found.Items, 1)
		require.Equal(t,
			"example2",
			mustNestedString(found.Items[0].Object, "metadata", "name"),
		)

		// Create bindings
		scopeDashboardBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: "default", // actually org1
			GVR: schema.GroupVersionResource{
				Group: "scope.grafana.app", Version: "v0alpha1", Resource: "scopedashboardbindings",
			},
		})
		_, err = scopeDashboardBindingClient.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/example-scope-dashboard-binding-abc.yaml"),
			createOptions,
		)
		require.NoError(t, err)
		_, err = scopeDashboardBindingClient.Resource.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/example-scope-dashboard-binding-xyz.yaml"),
			createOptions,
		)
		require.NoError(t, err)

		found, err = scopeDashboardBindingClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, found.Items, 2)
	})
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, _ := unstructured.NestedString(obj, fields...)
	return v
}
