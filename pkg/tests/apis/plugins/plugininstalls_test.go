package plugins

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

var gvrPluginInstalls = schema.GroupVersionResource{
	Group:    "plugins.grafana.app",
	Version:  "v0alpha1",
	Resource: "plugininstalls",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPluginInstalls(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})
	_, err := helper.NewDiscoveryClient().ServerResourcesForGroupVersion(gvrPluginInstalls.GroupVersion().String())
	require.NoError(t, err)

	t.Run("read only views", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Org1.Admin.Identity.GetNamespace(),
			GVR:       gvrPluginInstalls,
		})
		_, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
	})
}
