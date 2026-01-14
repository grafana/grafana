package identity

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
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
			doTeamBindingFieldSelectionTests(t, helper)

			if mode < 3 {
				doTeamBindingCRUDTestsUsingTheLegacyAPIs(t, helper)
			}
		})
	}
}

func doTeamBindingCRUDTestsUsingTheNewAPIs(t *testing.T, helper *apis.K8sTestHelper, team *unstructured.Unstructured, user *unstructured.Unstructured) {
	t.Run("should create/update/get/delete team binding using the new APIs", func(t *testing.T) {
		ctx := context.Background()

		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		// Create the team binding
		toCreate := createTeamBindingObject(helper, user.GetName(), team.GetName())
		created, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		defer func() {
			_ = teamBindingClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		}()

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, user.GetName(), createdSpec["subject"].(map[string]interface{})["name"])
		require.Equal(t, team.GetName(), createdSpec["teamRef"].(map[string]interface{})["name"])
		require.Equal(t, "admin", createdSpec["permission"])
		require.Equal(t, false, createdSpec["external"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)

		// Get the team binding
		response, err := teamBindingClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, response)

		var actual iamv0alpha1.TeamBinding
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(response.Object, &actual))
		require.Equal(t, user.GetName(), actual.Spec.Subject.Name)
		require.Equal(t, team.GetName(), actual.Spec.TeamRef.Name)
		require.Equal(t, iamv0alpha1.TeamBindingTeamPermissionAdmin, actual.Spec.Permission)
		require.False(t, actual.Spec.External)
		require.Equal(t, createdUID, actual.Name)

		// Update the team binding
		toUpdate := toCreate.DeepCopy()
		toUpdate.Object["spec"].(map[string]interface{})["permission"] = "member"
		toUpdate.Object["metadata"].(map[string]interface{})["name"] = createdUID
		updated, err := teamBindingClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		updatedSpec := updated.Object["spec"].(map[string]interface{})
		require.Equal(t, createdUID, updated.GetName())
		require.Equal(t, user.GetName(), updatedSpec["subject"].(map[string]interface{})["name"])
		require.Equal(t, team.GetName(), updatedSpec["teamRef"].(map[string]interface{})["name"])
		require.Equal(t, "member", updatedSpec["permission"])
		require.Equal(t, false, updatedSpec["external"])

		// Get the team binding
		response, err = teamBindingClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, response)

		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(response.Object, &actual))
		require.Equal(t, user.GetName(), actual.Spec.Subject.Name)
		require.Equal(t, team.GetName(), actual.Spec.TeamRef.Name)
		require.Equal(t, iamv0alpha1.TeamBindingTeamPermissionMember, actual.Spec.Permission)
		require.False(t, actual.Spec.External)
		require.Equal(t, createdUID, actual.Name)

		// Delete the team binding
		err = teamBindingClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Verify the team binding is deleted
		_, err = teamBindingClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "not found")
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

				toCreate := createTeamBindingObject(helper, user.GetName(), team.GetName())
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

		toCreate := createTeamBindingObject(helper, "", team.GetName())

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

		toCreate := createTeamBindingObject(helper, user.GetName(), "")

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

		toCreate := createTeamBindingObject(helper, user.GetName(), team.GetName())
		toCreate.Object["spec"].(map[string]interface{})["permission"] = "invalid"

		_, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "invalid permission")
	})

	t.Run("should not be able to update team binding with insufficient permissions", func(t *testing.T) {
		for _, u := range []apis.User{
			helper.Org1.Editor,
			helper.Org1.Viewer,
		} {
			t.Run(fmt.Sprintf("with basic role_%s", u.Identity.GetOrgRole()), func(t *testing.T) {
				ctx := context.Background()

				// Create the team binding using admin
				adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
					User:      helper.Org1.Admin,
					Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:       gvrTeamBindings,
				})

				toCreate := createTeamBindingObject(helper, user.GetName(), team.GetName())
				created, err := adminClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
				require.NoError(t, err)

				defer func() {
					_ = adminClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
				}()

				teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
					User:      u,
					Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:       gvrTeamBindings,
				})

				toUpdate := created.DeepCopy()
				toUpdate.Object["spec"].(map[string]interface{})["permission"] = "member"
				_, err = teamBindingClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
				require.Error(t, err)

				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})

	t.Run("should not be able to update team binding if the team binding does not exist", func(t *testing.T) {
		ctx := context.Background()
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		toUpdate := createTeamBindingObject(helper, user.GetName(), team.GetName())
		toUpdate.Object["metadata"].(map[string]interface{})["name"] = "invalid-team-binding-name"
		_, err := teamBindingClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "not found")
	})

	t.Run("should not be able to update team binding with teamRef change", func(t *testing.T) {
		ctx := context.Background()
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		toCreate := createTeamBindingObject(helper, user.GetName(), team.GetName())
		created, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)

		defer func() {
			_ = teamBindingClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		}()

		toUpdate := toCreate.DeepCopy()
		toUpdate.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = "test-team-2"
		toUpdate.Object["metadata"].(map[string]interface{})["name"] = created.GetName()
		_, err = teamBindingClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "teamRef is immutable")
	})

	t.Run("should not be able to update team binding with subject change", func(t *testing.T) {
		ctx := context.Background()
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		toCreate := createTeamBindingObject(helper, user.GetName(), team.GetName())
		created, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)

		defer func() {
			_ = teamBindingClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		}()

		toUpdate := toCreate.DeepCopy()
		toUpdate.Object["metadata"].(map[string]interface{})["name"] = created.GetName()
		toUpdate.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = "test-user-2"

		_, err = teamBindingClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "subject is immutable")
	})

	t.Run("should not be able to update team binding with external change", func(t *testing.T) {
		ctx := context.Background()
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		toCreate := createTeamBindingObject(helper, user.GetName(), team.GetName())
		created, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)

		defer func() {
			_ = teamBindingClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		}()

		toUpdate := toCreate.DeepCopy()
		toUpdate.Object["spec"].(map[string]interface{})["external"] = true
		toUpdate.Object["metadata"].(map[string]interface{})["name"] = created.GetName()
		_, err = teamBindingClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "external is immutable")
	})

	t.Run("should not be able to update team binding with invalid permission", func(t *testing.T) {
		ctx := context.Background()
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		toCreate := createTeamBindingObject(helper, user.GetName(), team.GetName())
		created, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)

		defer func() {
			_ = teamBindingClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		}()

		toUpdate := createTeamBindingObject(helper, user.GetName(), team.GetName())
		toUpdate.Object["spec"].(map[string]interface{})["permission"] = "invalid"
		toUpdate.Object["metadata"].(map[string]interface{})["name"] = created.GetName()
		_, err = teamBindingClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "invalid permission")
	})
}

func doTeamBindingCRUDTestsUsingTheLegacyAPIs(t *testing.T, helper *apis.K8sTestHelper) {
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

		type legacyTeamBindingPostResponse struct {
			Message string `json:"message"`
		}

		teamBindingRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/teams/" + teamRsp.Result.UID + "/members",
			Body:   []byte(legacyTeamBindingPayload),
		}, &legacyTeamBindingPostResponse{})

		require.NotNil(t, teamBindingRsp)
		require.Equal(t, 200, teamBindingRsp.Response.StatusCode)

		type legacyTeamBindingGetResponse struct {
			UID    string `json:"uid"`
			UserID int64  `json:"userId"`
			TeamID int64  `json:"teamId"`
		}

		// Get the binding UID using the legacy API
		legacyTeamBindingUIDRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   "/api/teams/" + teamRsp.Result.UID + "/members",
		}, &[]legacyTeamBindingGetResponse{})

		require.NotNil(t, legacyTeamBindingUIDRsp)
		require.Equal(t, 200, legacyTeamBindingUIDRsp.Response.StatusCode)

		teamBindingName := ""
		for _, binding := range *legacyTeamBindingUIDRsp.Result {
			if binding.UserID == userRsp.Result.ID && binding.TeamID == teamRsp.Result.ID {
				teamBindingName = binding.UID
				break
			}
		}
		require.NotEmpty(t, teamBindingName)

		// Get team binding using new API
		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})

		response, err := teamBindingClient.Resource.Get(ctx, teamBindingName, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, response)

		var actual iamv0alpha1.TeamBinding
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(response.Object, &actual))
		require.Equal(t, iamv0alpha1.TeamBindingTeamPermissionMember, actual.Spec.Permission)
		require.Equal(t, userRsp.Result.UID, actual.Spec.Subject.Name)
		require.Equal(t, teamRsp.Result.UID, actual.Spec.TeamRef.Name)
		require.Equal(t, teamBindingName, actual.Name)
	})
}

func doTeamBindingFieldSelectionTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should list team bindings using field selectors", func(t *testing.T) {
		ctx := context.Background()

		var teamNames []string
		var userNames []string
		var bindingNames []string

		teamBindingClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeamBindings,
		})
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Helper to create teams
		createTeam := func(name string, email string) *unstructured.Unstructured {
			obj := helper.LoadYAMLOrJSONFile("testdata/team-test-create-v0.yaml")
			obj.SetName(name)
			if email != "" {
				obj.Object["spec"].(map[string]interface{})["email"] = email
			}

			created, err := teamClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)
			teamNames = append(teamNames, created.GetName())
			return created
		}

		// Helper to create users
		createUser := func(name string, email string, login string) *unstructured.Unstructured {
			obj := helper.LoadYAMLOrJSONFile("testdata/user-test-create-v0.yaml")
			obj.SetName(name)

			spec := obj.Object["spec"].(map[string]interface{})
			spec["email"] = email
			spec["login"] = login

			created, err := userClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)
			userNames = append(userNames, created.GetName())
			return created
		}

		teamA := createTeam("team-a", "teama@example.com")
		teamB := createTeam("team-b", "teamb@example.com")
		user1 := createUser("user-1", "user1@example.com", "user1")
		user2 := createUser("user-2", "user2@example.com", "user2")

		createBinding := func(user *unstructured.Unstructured, team *unstructured.Unstructured) {
			toCreate := helper.LoadYAMLOrJSONFile("testdata/teambinding-test-create-v0.yaml")
			toCreate.SetName("")
			toCreate.SetGenerateName("binding-")
			toCreate.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = user.GetName()
			toCreate.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = team.GetName()

			created, err := teamBindingClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
			require.NoError(t, err)
			bindingNames = append(bindingNames, created.GetName())
		}

		// Create 4 bindings
		createBinding(user1, teamA)
		createBinding(user2, teamA)
		createBinding(user1, teamB)
		createBinding(user2, teamB)

		t.Cleanup(func() {
			cleanupCtx := context.Background()

			for _, name := range bindingNames {
				_ = teamBindingClient.Resource.Delete(cleanupCtx, name, metav1.DeleteOptions{})
			}
			for _, name := range teamNames {
				_ = teamClient.Resource.Delete(cleanupCtx, name, metav1.DeleteOptions{})
			}
			for _, name := range userNames {
				_ = userClient.Resource.Delete(cleanupCtx, name, metav1.DeleteOptions{})
			}
		})

		// Verify we have at least 4 bindings overall
		all, err := teamBindingClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(all.Items), 4)

		// Query 1: select by teamRef.name, should return 2 of the 4
		listByTeam, err := teamBindingClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: fmt.Sprintf("spec.teamRef.name=%s", teamA.GetName()),
		})
		require.NoError(t, err)
		require.Len(t, listByTeam.Items, 2)
		for _, item := range listByTeam.Items {
			var actual iamv0alpha1.TeamBinding
			require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(item.Object, &actual))
			require.Equal(t, teamA.GetName(), actual.Spec.TeamRef.Name)
		}

		// Query 2: select by subject.name, should return 2 of the 4
		listByUser, err := teamBindingClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: fmt.Sprintf("spec.subject.name=%s", user1.GetName()),
		})
		require.NoError(t, err)
		require.Len(t, listByUser.Items, 2)
		for _, item := range listByUser.Items {
			var actual iamv0alpha1.TeamBinding
			require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(item.Object, &actual))
			require.Equal(t, user1.GetName(), actual.Spec.Subject.Name)
		}
	})
}

func createTeamBindingObject(helper *apis.K8sTestHelper, userName, teamName string) *unstructured.Unstructured {
	obj := helper.LoadYAMLOrJSONFile("testdata/teambinding-test-create-v0.yaml")
	obj.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = userName
	obj.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = teamName
	return obj
}
