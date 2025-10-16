package identity

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationTeamBindings(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// TODO: Add rest.Mode4 when it's supported
	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("Team binding CRUD operations with dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"teambindings.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesAuthnMutation,
				},
			})

			ctx := context.Background()

			// Create a team
			teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User:      helper.Org1.Admin,
				Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
				GVR:       gvrTeams,
			})

			team, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, team)

			// Create a user
			userClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User:      helper.Org1.Admin,
				Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
				GVR:       gvrUsers,
			})

			user, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, user)

			doTeamBindingCRUDTestsUsingTheNewAPIs(t, helper, team, user)

			if mode < 3 {
				doTeamBindingCRUDTestsUsingTheLegacyAPIs(t, helper, mode)
			}
		})
	}
}

func doTeamBindingCRUDTestsUsingTheNewAPIs(t *testing.T, helper *apis.K8sTestHelper, team *unstructured.Unstructured, user *unstructured.Unstructured) {
	t.Run("should create/get team binding using the new APIs", func(t *testing.T) {
		ctx := context.Background()

		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		// Create the team binding
		toCreate := helper.LoadYAMLOrJSONFile("testdata/teambinding-test-create-v0.yaml")
		toCreate.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = user.GetName()
		toCreate.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = team.GetName()
		created, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, user.GetName(), createdSpec["subject"].(map[string]interface{})["name"])
		require.Equal(t, team.GetName(), createdSpec["teamRef"].(map[string]interface{})["name"])
		require.Equal(t, "admin", createdSpec["permission"])
		require.Equal(t, false, createdSpec["external"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)

		// Get the team binding
		fetched, err := teamBindingClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, user.GetName(), fetchedSpec["subject"].(map[string]interface{})["name"])
		require.Equal(t, team.GetName(), fetchedSpec["teamRef"].(map[string]interface{})["name"])
		require.Equal(t, "admin", fetchedSpec["permission"])
		require.Equal(t, false, fetchedSpec["external"])

		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())
	})

	t.Run("should not be able to create team binding when using a user with insufficient permissions", func(t *testing.T) {
		for _, u := range []apis.User{
			helper.Org1.Editor,
			helper.Org1.Viewer,
		} {
			t.Run(fmt.Sprintf("with basic role_%s", u.Identity.GetOrgRole()), func(t *testing.T) {
				ctx := context.Background()
				teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
					User:      u,
					Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:       gvrTeamBindings,
				})

				toCreate := helper.LoadYAMLOrJSONFile("testdata/teambinding-test-create-v0.yaml")
				toCreate.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = user.GetName()
				toCreate.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = team.GetName()
				_, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
				require.Error(t, err)

				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})

	t.Run("should not be able to create team binding without a subject", func(t *testing.T) {
		ctx := context.Background()
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		toCreate := helper.LoadYAMLOrJSONFile("testdata/teambinding-test-create-v0.yaml")
		toCreate.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = ""
		toCreate.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = team.GetName()

		_, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "subject is required")
	})

	t.Run("should not be able to create team binding without a teamRef", func(t *testing.T) {
		ctx := context.Background()
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		toCreate := helper.LoadYAMLOrJSONFile("testdata/teambinding-test-create-v0.yaml")
		toCreate.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = user.GetName()
		toCreate.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = ""

		_, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "teamRef is required")
	})

	t.Run("should not be able to create team binding with invalid permission", func(t *testing.T) {
		ctx := context.Background()
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		toCreate := helper.LoadYAMLOrJSONFile("testdata/teambinding-test-create-v0.yaml")
		toCreate.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = user.GetName()
		toCreate.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = team.GetName()
		toCreate.Object["spec"].(map[string]interface{})["permission"] = "invalid"

		_, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "invalid permission")
	})
}

func doTeamBindingCRUDTestsUsingTheLegacyAPIs(t *testing.T, helper *apis.K8sTestHelper, mode rest.DualWriterMode) {
	t.Run("should create team binding using legacy APIs and get it using the new APIs", func(t *testing.T) {
		ctx := context.Background()

		// Create a team using legacy API
		legacyTeamPayload := `{
			"name": "Test Team Legacy",
			"email": "testteamlegacy@example.com"
		}`

		type legacyTeamResponse struct {
			UID string `json:"uid"`
			ID  int64  `json:"teamId"`
		}

		teamRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/teams",
			Body:   []byte(legacyTeamPayload),
		}, &legacyTeamResponse{})

		require.NotNil(t, teamRsp)
		require.Equal(t, 200, teamRsp.Response.StatusCode)
		require.NotEmpty(t, teamRsp.Result.UID)

		// Create a user using legacy API
		legacyUserPayload := `{
			"name": "Test User 2",
			"email": "testuser2@example.com",
			"login": "testuser2",
			"password": "password123"
		}`

		type legacyUserResponse struct {
			UID string `json:"uid"`
			ID  int64  `json:"id"`
		}

		userRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/admin/users",
			Body:   []byte(legacyUserPayload),
		}, &legacyUserResponse{})

		require.NotNil(t, userRsp)
		require.Equal(t, 200, userRsp.Response.StatusCode)
		require.NotEmpty(t, userRsp.Result.UID)

		// Create team binding using legacy API
		legacyTeamBindingPayload := `{
			"userId": ` + fmt.Sprintf("%d", userRsp.Result.ID) + `,
			"teamId": ` + fmt.Sprintf("%d", teamRsp.Result.ID) + `,
			"permission": "member"
		}`

		type legacyTeamBindingResponse struct {
			UID        string `json:"uid"`
			UserID     int64  `json:"userId"`
			TeamID     int64  `json:"teamId"`
			Permission string `json:"permission"`
		}

		teamBindingRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/teams/" + teamRsp.Result.UID + "/members",
			Body:   []byte(legacyTeamBindingPayload),
		}, &legacyTeamBindingResponse{})

		require.NotNil(t, teamBindingRsp)
		require.Equal(t, 200, teamBindingRsp.Response.StatusCode)

		// Get team binding using new API
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		teamBindingName := teamBindingRsp.Result.UID
		teamBinding, err := teamBindingClient.Resource.Get(ctx, teamBindingName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, teamBinding)

		teamBindingSpec := teamBinding.Object["spec"].(map[string]interface{})
		require.Equal(t, "member", teamBindingSpec["permission"])
		require.Equal(t, userRsp.Result.UID, teamBindingSpec["subject"].(map[string]interface{})["name"])
		require.Equal(t, teamRsp.Result.UID, teamBindingSpec["teamRef"].(map[string]interface{})["name"])
		require.Equal(t, teamBindingName, teamBinding.GetName())
	})
}
