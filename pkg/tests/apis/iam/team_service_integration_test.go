package identity

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// go test --tags "pro" -timeout 120s -run ^TestIntegrationTeamService$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationTeamService(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type createResponse struct {
		UID    string `json:"uid"`
		TeamID int64  `json:"teamId"`
	}

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5} {
		t.Run(fmt.Sprintf("dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"teams.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesTeamsApi,
					featuremgmt.FlagKubernetesTeamsRedirect,
				},
			})

			createRsp := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: "POST",
				Path:   "/api/teams",
				Body:   []byte(`{"name": "K8s Service Team", "email": "k8s-team@example.com"}`),
			}, &createResponse{})

			require.NotNil(t, createRsp)
			require.Equal(t, 200, createRsp.Response.StatusCode)
			require.NotEmpty(t, createRsp.Result.UID)

			if mode <= rest.Mode2 {
				// Modes 0–2 write to the legacy SQL database, so the legacy API can verify the team.
				// TeamID is only populated in these modes because SetDeprecatedInternalID is only set
				// by the LegacyStore on the returned k8s object.
				t.Run("should create team via k8s service and verify it using the legacy API", func(t *testing.T) {
					require.NotZero(t, createRsp.Result.TeamID)

					type getResponse struct {
						ID    int64  `json:"id"`
						UID   string `json:"uid"`
						Name  string `json:"name"`
						Email string `json:"email"`
					}

					getRsp := apis.DoRequest(helper, apis.RequestParams{
						User:   helper.Org1.Admin,
						Method: "GET",
						Path:   fmt.Sprintf("/api/teams/%s", createRsp.Result.UID),
					}, &getResponse{})

					require.Equal(t, 200, getRsp.Response.StatusCode)
					require.Equal(t, createRsp.Result.TeamID, getRsp.Result.ID)
					require.Equal(t, createRsp.Result.UID, getRsp.Result.UID)
					require.Equal(t, "K8s Service Team", getRsp.Result.Name)
					require.Equal(t, "k8s-team@example.com", getRsp.Result.Email)

					deleteRsp := apis.DoRequest(helper, apis.RequestParams{
						User:   helper.Org1.Admin,
						Method: "DELETE",
						Path:   fmt.Sprintf("/api/teams/%s", createRsp.Result.UID),
					}, &struct{}{})
					require.Equal(t, 200, deleteRsp.Response.StatusCode)
				})
			} else {
				// Modes 3–5 use the kubernetes API as the primary (or only) storage, so the k8s
				// client is used for verification and cleanup.
				t.Run("should create team via k8s service and verify it using the kubernetes API", func(t *testing.T) {
					ctx := context.Background()

					teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
						User:      helper.Org1.Admin,
						Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
						GVR:       gvrTeams,
					})

					team, err := teamClient.Resource.Get(ctx, createRsp.Result.UID, metav1.GetOptions{})
					require.NoError(t, err)

					teamSpec := team.Object["spec"].(map[string]interface{})
					require.Equal(t, "K8s Service Team", teamSpec["title"])
					require.Equal(t, "k8s-team@example.com", teamSpec["email"])

					err = teamClient.Resource.Delete(ctx, createRsp.Result.UID, metav1.DeleteOptions{})
					require.NoError(t, err)
				})
			}
		})
	}
}
