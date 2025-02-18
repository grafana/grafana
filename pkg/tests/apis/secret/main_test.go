package secret

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDiscoveryClient(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			// Required to start the example service
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagSecretsManagementAppPlatform,
		},
	})

	t.Run("check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()

		resources, err := disco.ServerResourcesForGroupVersion("secret.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)

		var apiResourceList map[string]any
		require.NoError(t, json.Unmarshal(v1Disco, &apiResourceList))

		groupVersion, ok := apiResourceList["groupVersion"].(string)
		require.True(t, ok)
		require.Equal(t, "secret.grafana.app/v0alpha1", groupVersion)

		apiResources, ok := apiResourceList["resources"].([]any)
		require.True(t, ok)
		require.Len(t, apiResources, 3) // securevalue + keeper + (subresources...)
	})
}

func mustGenerateSecureValue(t *testing.T, helper *apis.K8sTestHelper, user apis.User, keeperName string) *unstructured.Unstructured {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	secureValueClient := helper.GetResourceClient(apis.ResourceClientArgs{
		// #TODO: figure out permissions topic
		User: user,
		GVR:  gvrSecureValues,
	})

	testSecureValue := helper.LoadYAMLOrJSONFile("testdata/secure-value-generate.yaml")
	testSecureValue.Object["spec"].(map[string]any)["keeper"] = keeperName

	raw, err := secureValueClient.Resource.Create(ctx, testSecureValue, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, raw)

	t.Cleanup(func() {
		require.NoError(t, secureValueClient.Resource.Delete(ctx, raw.GetName(), metav1.DeleteOptions{}))
	})

	return raw
}

func mustGenerateKeeper(t *testing.T, helper *apis.K8sTestHelper, user apis.User, specType map[string]any, testFile string) *unstructured.Unstructured {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	keeperClient := helper.GetResourceClient(apis.ResourceClientArgs{
		// #TODO: figure out permissions topic
		User: user,
		GVR:  gvrKeepers,
	})

	if testFile == "" {
		testFile = "testdata/keeper-sql-generate.yaml"
	}
	testKeeper := helper.LoadYAMLOrJSONFile(testFile)
	if specType != nil {
		testKeeper.Object["spec"] = specType
	}

	raw, err := keeperClient.Resource.Create(ctx, testKeeper, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, raw)

	t.Cleanup(func() {
		require.NoError(t, keeperClient.Resource.Delete(ctx, raw.GetName(), metav1.DeleteOptions{}))
	})

	return raw
}
