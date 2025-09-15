package apis

import (
	"fmt"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/version"
	"k8s.io/client-go/kubernetes"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationOpenAPIs(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagQueryService, // Query Library
			featuremgmt.FlagProvisioning,
			featuremgmt.FlagInvestigationsBackend,
			featuremgmt.FlagGrafanaAdvisor,
			featuremgmt.FlagKubernetesAlertingRules,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // all datasources
			featuremgmt.FlagKubernetesShortURLs,
		},
	})

	t.Run("check valid version response", func(t *testing.T) {
		client, err := kubernetes.NewForConfig(h.NewAdminRestConfig())
		require.NoError(t, err)

		info, err := client.ServerVersion()
		require.NoError(t, err)
		require.Equal(t, runtime.Version(), info.GoVersion)
		require.Equal(t, "1", info.Major)
		require.Equal(t, "33", info.Minor)

		// Make sure the gitVersion is parsable
		v, err := version.Parse(info.GitVersion)
		require.NoError(t, err)
		require.Equal(t, info.Major, fmt.Sprintf("%d", v.Major()))
		require.Equal(t, info.Minor, fmt.Sprintf("%d", v.Minor()))

		// Check the v3 path resolves properly
		// NOTE: fetching the v2 schema sometimes returns a 503 in our test infrastructure
		// Removing the explicit `OneOf` properties from InlineSecureValue in:
		// https://github.com/grafana/grafana/blob/main/pkg/apimachinery/apis/common/v0alpha1/secure_values.go#L78
		// will consistently support V2, however kubectl and everything else continues to work
		disco := h.NewDiscoveryClient()
		paths, err := disco.OpenAPIV3().Paths()

		require.NoError(t, err, "requesting OpenAPI v3")
		require.NotEmpty(t, paths, "has registered paths")
	})

	dir := "openapi_snapshots"

	var groups = []schema.GroupVersion{{
		Group:   "dashboard.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "dashboard.grafana.app",
		Version: "v1beta1",
	}, {
		Group:   "dashboard.grafana.app",
		Version: "v2alpha1",
	}, {
		Group:   "folder.grafana.app",
		Version: "v1beta1",
	}, {
		Group:   "provisioning.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "iam.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "investigations.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "advisor.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "playlist.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "notifications.alerting.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "rules.alerting.grafana.app",
		Version: "v0alpha1",
	}, {
		Group:   "shorturl.grafana.app",
		Version: "v1alpha1",
	}}
	for _, gv := range groups {
		VerifyOpenAPISnapshots(t, dir, gv, h)
	}
}
