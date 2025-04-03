package apis

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/version"
	apimachineryversion "k8s.io/apimachinery/pkg/version"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationOpenAPIs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	h := NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagKubernetesClientDashboardsFolders, // Will be default on by G12
			featuremgmt.FlagQueryService,                      // Query Library
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagInvestigationsBackend,
		},
	})

	t.Run("check valid version response", func(t *testing.T) {
		disco := h.NewDiscoveryClient()
		req := disco.RESTClient().Get().
			Prefix("version").
			SetHeader("Accept", "application/json")

		result := req.Do(context.Background())
		require.NoError(t, result.Error())

		raw, err := result.Raw()
		require.NoError(t, err)
		info := apimachineryversion.Info{}
		err = json.Unmarshal(raw, &info)
		require.NoError(t, err)

		// Make sure the gitVersion is parsable
		v, err := version.Parse(info.GitVersion)
		require.NoError(t, err)
		require.Equal(t, info.Major, fmt.Sprintf("%d", v.Major()))
		require.Equal(t, info.Minor, fmt.Sprintf("%d", v.Minor()))
	})

	dir := "openapi_snapshots"

	var groups = []schema.GroupVersion{{
		Group:   "dashboard.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "dashboard.grafana.app",
		Version: "v1alpha1",
	}, {
		Group:   "dashboard.grafana.app",
		Version: "v2alpha1",
	}, {
		Group:   "folder.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "provisioning.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "iam.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "investigations.grafana.app",
		Version: "v0alpha1",
	}}
	for _, gv := range groups {
		VerifyOpenAPISnapshots(t, dir, gv, h)
	}
}
