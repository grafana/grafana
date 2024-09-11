package scopes

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIntegrationScopeNodesExample(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode.")
	}

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the example service
		},
	})

	scopeClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR: schema.GroupVersionResource{
			Group: "scope.grafana.app", Version: "v0alpha1", Resource: "scopes",
		},
	})

	scopeNodesClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default", // actually org1
		GVR: schema.GroupVersionResource{
			Group: "scope.grafana.app", Version: "v0alpha1", Resource: "scopenodes",
		},
	})

	createOptions := metav1.CreateOptions{FieldValidation: "Strict"}

	t.Run("Create scopes", func(t *testing.T) {
		ul := jsonListToUnstructuredList(t, "testdata/scopeNodesExample/scopes.json")

		for _, item := range ul.Items {
			_, err := scopeClient.Resource.Create(ctx, &item, createOptions)
			require.NoError(t, err)
		}

		found, err := scopeClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, found.Items, 5)
	})

	t.Run("Create scopeNodes", func(t *testing.T) {
		ul := jsonListToUnstructuredList(t, "testdata/scopeNodesExample/scopeNodes.json")

		for _, item := range ul.Items {
			_, err := scopeNodesClient.Resource.Create(ctx, &item, createOptions)
			require.NoError(t, err)
		}

		found, err := scopeNodesClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, found.Items, 12)
	})
}

func jsonListToUnstructuredList(t *testing.T, fname string) (ul unstructured.UnstructuredList) {
	// nolint:gosec
	f, err := os.ReadFile(fname)
	require.NoError(t, err)

	err = json.Unmarshal(f, &ul)
	require.NoError(t, err)
	return
}
