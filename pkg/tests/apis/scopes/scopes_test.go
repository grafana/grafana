package playlist

import (
	"context"
	"encoding/json"
	"fmt"
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
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()
		resources, err := disco.ServerResourcesForGroupVersion("scope.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)
		fmt.Printf("%s", string(v1Disco))

		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "scope.grafana.app/v0alpha1",
			"resources": [
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
		scopeClient := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
			Group: "scope.grafana.app", Version: "v0alpha1", Resource: "scopes",
		})
		s0, err := scopeClient.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/example-scope.yaml"),
			metav1.CreateOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "example", s0.GetName())
		s1, err := scopeClient.Get(ctx, "example", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t,
			mustNestedString(s0.Object, "spec", "title"),
			mustNestedString(s1.Object, "spec", "title"),
		)

		// Create bindings
		scopeDashboardBindingClient := helper.Org1.Admin.ResourceClient(t, schema.GroupVersionResource{
			Group: "scope.grafana.app", Version: "v0alpha1", Resource: "scopedashboardbindings",
		})
		b0, err := scopeDashboardBindingClient.Create(ctx,
			helper.LoadYAMLOrJSONFile("testdata/example-scope-dashboard-binding.yaml"),
			metav1.CreateOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "example_abc", b0.GetName())
	})
}

func mustNestedString(obj map[string]interface{}, fields ...string) string {
	v, _, _ := unstructured.NestedString(obj, "spec", "title")
	return v
}
