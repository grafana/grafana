package secret

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
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
		require.Len(t, apiResources, 2) // securevalue + keeper + (subresources...)
	})
}
