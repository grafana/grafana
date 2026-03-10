package identity

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// go test --tags "pro" -timeout 120s -run ^TestIntegrationTeams$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationTeams(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("Team CRUD operations with dual writer mode %d", mode), func(t *testing.T) {
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
					featuremgmt.FlagKubernetesAuthnMutation,
				},
			})

			doTeamCRUDTestsUsingTheNewAPIs(t, helper)

			if mode < 3 {
				doTeamCRUDTestsUsingTheLegacyAPIs(t, helper, mode)
			}
		})
	}
}

func doTeamCRUDTestsUsingTheNewAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create/get/update/delete team using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()

		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		// Create the team
		created, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 1", createdSpec["title"])
		require.Equal(t, "testteam1@example123.com", createdSpec["email"])
		require.Equal(t, false, createdSpec["provisioned"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)

		// Get the team
		fetched, err := teamClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 1", fetchedSpec["title"])
		require.Equal(t, "testteam1@example123.com", fetchedSpec["email"])
		require.Equal(t, false, fetchedSpec["provisioned"])

		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())

		// Update the team
		updatedTeam, err := teamClient.Resource.Update(ctx, helper.LoadYAMLOrJSONFile("testdata/team-test-update-v0.yaml"), metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updatedTeam)

		updatedSpec := updatedTeam.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 2", updatedSpec["title"])
		require.Equal(t, "testteam2@example123.com", updatedSpec["email"])
		require.Equal(t, false, updatedSpec["provisioned"])

		verifiedTeam, err := teamClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, verifiedTeam)

		verifiedSpec := verifiedTeam.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 2", verifiedSpec["title"])
		require.Equal(t, "testteam2@example123.com", verifiedSpec["email"])
		require.Equal(t, false, verifiedSpec["provisioned"])

		// Delete the team
		err = teamClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.NoError(t, err)

		_, err = teamClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, "Failure", statusErr.ErrStatus.Status)
		require.Contains(t, statusErr.ErrStatus.Message, "not found")
	})

	t.Run("should not be able to create team when using a user with insufficient permissions", func(t *testing.T) {
		for _, user := range []apis.User{
			helper.Org1.Editor,
			helper.Org1.Viewer,
		} {
			t.Run(fmt.Sprintf("with basic role_%s", user.Identity.GetOrgRole()), func(t *testing.T) {
				ctx := context.Background()
				teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
					User:      user,
					Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:       gvrTeams,
				})

				_, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
				require.Error(t, err)
				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})

	t.Run("should not be able to create team without a title", func(t *testing.T) {
		ctx := context.Background()
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		toCreate := helper.LoadYAMLOrJSONFile("testdata/team-test-no-title-v0.yaml")

		_, err := teamClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "the team must have a title")
	})

	t.Run("should not be able to create provisioned team as a user", func(t *testing.T) {
		ctx := context.Background()
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		toCreate := helper.LoadYAMLOrJSONFile("testdata/team-test-provisioned-v0.yaml")

		_, err := teamClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "provisioned teams are only allowed for service accounts")
	})

	t.Run("should not be able to set externalUID when not provisioned", func(t *testing.T) {
		ctx := context.Background()
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		toCreate := helper.LoadYAMLOrJSONFile("testdata/team-test-external-uid-without-provisioned-v0.yaml")

		_, err := teamClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "externalUID is only allowed for provisioned teams")
	})

	t.Run("should create team with generateName and get it using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()

		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		created, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/team-test-generate-name-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "Team with GenerateName", createdSpec["title"])
		require.Equal(t, false, createdSpec["provisioned"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)
		require.Contains(t, createdUID, "team-")

		fetched, err := teamClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Team with GenerateName", fetchedSpec["title"])
		require.Equal(t, false, fetchedSpec["provisioned"])

		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())

		// Cleanup
		err = teamClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("should list teams correctly", func(t *testing.T) {
		ctx := context.Background()

		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		// For ensuring that it is able to list a team which has external_uid = null and is_provisioned = null
		// only matters when legacy storage is involved
		env := helper.GetEnv()
		res, err := env.SQLStore.GetSqlxSession().Exec(ctx, "INSERT INTO team (org_id, uid, name, email, is_provisioned, external_uid, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			helper.Org1.Admin.Identity.GetOrgID(), "t000000001", "List Team 1", "list-team-1@example.com", nil, nil, time.Now(), time.Now())
		require.NoError(t, err)
		require.NotNil(t, res)

		withoutEmail, err := env.SQLStore.GetSqlxSession().Exec(ctx, "INSERT INTO team (org_id, uid, name, email, is_provisioned, external_uid, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			helper.Org1.Admin.Identity.GetOrgID(), "t000000002", "List Team 2", nil, nil, nil, time.Now(), time.Now())
		require.NoError(t, err)
		require.NotNil(t, withoutEmail)

		list, err := teamClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotNil(t, list)

		// Cleanup
		_, err = env.SQLStore.GetSqlxSession().Exec(ctx, "DELETE FROM team WHERE uid IN (?, ?)", "t000000001", "t000000002")
		require.NoError(t, err)
	})
}

func doTeamCRUDTestsUsingTheLegacyAPIs(t *testing.T, helper *apis.K8sTestHelper, mode rest.DualWriterMode) {
	t.Run("should create team using legacy APIs and get/update/delete it using the new APIs", func(t *testing.T) {
		ctx := context.Background()

		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		legacyTeamPayload := `{
			"name": "Test Team 2",
			"email": "testteam2@example.com"
		}`

		type legacyCreateResponse struct {
			UID string `json:"uid"`
			ID  int64  `json:"teamId"`
		}

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/teams",
			Body:   []byte(legacyTeamPayload),
		}, &legacyCreateResponse{})

		require.NotNil(t, rsp)
		require.Equal(t, 200, rsp.Response.StatusCode)
		require.NotEmpty(t, rsp.Result.UID)

		team, err := teamClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, team)

		teamSpec := team.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 2", teamSpec["title"])
		require.Equal(t, "testteam2@example.com", teamSpec["email"])
		require.Equal(t, false, teamSpec["provisioned"])

		require.Equal(t, rsp.Result.UID, team.GetName())
		require.Equal(t, "default", team.GetNamespace())

		// Updating the team is not supported in Mode2 if the team has been created using the legacy APIs
		if mode < rest.Mode2 {
			team.Object["spec"].(map[string]interface{})["title"] = "Updated Test Team 2"
			team.Object["spec"].(map[string]interface{})["email"] = "updated@example.com"

			updatedTeam, err := teamClient.Resource.Update(ctx, team, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, updatedTeam)

			updatedSpec := updatedTeam.Object["spec"].(map[string]interface{})
			require.Equal(t, "Updated Test Team 2", updatedSpec["title"])
			require.Equal(t, "updated@example.com", updatedSpec["email"])
			require.Equal(t, false, updatedSpec["provisioned"])

			verifiedTeam, err := teamClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, verifiedTeam)

			verifiedSpec := verifiedTeam.Object["spec"].(map[string]interface{})
			require.Equal(t, "Updated Test Team 2", verifiedSpec["title"])
			require.Equal(t, "updated@example.com", verifiedSpec["email"])
			require.Equal(t, false, verifiedSpec["provisioned"])
		}

		// Delete the team
		err = teamClient.Resource.Delete(ctx, rsp.Result.UID, metav1.DeleteOptions{})
		require.NoError(t, err)

		_, err = teamClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, "Failure", statusErr.ErrStatus.Status)
		require.Contains(t, statusErr.ErrStatus.Message, "not found")
	})
}
