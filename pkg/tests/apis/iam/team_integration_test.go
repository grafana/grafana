package identity

import (
	"context"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
)

func TestIntegrationTeams(t *testing.T) {
	t.Run("should create a team", func(t *testing.T) {
		ctx := context.Background()

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    false,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"teams.iam.grafana.app": {
					DualWriterMode: rest.Mode0,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
				featuremgmt.FlagKubernetesAuthnMutation,
			},
		})

		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		created, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
	})
}
