package identity

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestIntegrationUsers(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// TODO: Figure out why rest.Mode4 is failing
	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("User CRUD operations with dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesAuthnMutation,
				},
			})
			doUserCRUDTestsUsingTheNewAPIs(t, helper)

			if mode < 3 {
				doUserCRUDTestsUsingTheLegacyAPIs(t, helper)
			}
		})
	}
}

func doUserCRUDTestsUsingTheNewAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create user and delete it using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()

		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Create the user
		created, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		// Verify creation response
		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "testuser1@example123.com", createdSpec["email"])
		require.Equal(t, "testuser1", createdSpec["login"])
		require.Equal(t, "Test User 1", createdSpec["name"])
		require.Equal(t, false, createdSpec["provisioned"])

		// Get the UID from created user for fetching
		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)

		_, err = userClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		fetched, err := userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		// Verify fetched user matches created user
		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "testuser1@example123.com", fetchedSpec["email"])
		require.Equal(t, "testuser1", fetchedSpec["login"])
		require.Equal(t, "Test User 1", fetchedSpec["name"])
		require.Equal(t, false, fetchedSpec["provisioned"])

		// Verify metadata
		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())

		err = userClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Verify deletion
		_, err = userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})

	t.Run("should update user using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()

		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Create the user
		created, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/user-test-create-2-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		// Get the user to update
		createdUID := created.GetName()
		userToUpdate, err := userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)

		// Modify the user spec
		spec := userToUpdate.Object["spec"].(map[string]interface{})
		spec["name"] = "Updated Test User"
		spec["email"] = "updated.test.user@example.com"
		userToUpdate.Object["spec"] = spec

		// Update the user
		updated, err := userClient.Resource.Update(ctx, userToUpdate, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		// Verify the update response
		updatedSpec := updated.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated Test User", updatedSpec["name"])
		require.Equal(t, "updated.test.user@example.com", updatedSpec["email"])

		// Fetch again to confirm
		fetched, err := userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated Test User", fetchedSpec["name"])
		require.Equal(t, "updated.test.user@example.com", fetchedSpec["email"])

		// Cleanup
		err = userClient.Resource.Delete(ctx, fetched.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("should not be able to create user when using a user with insufficient permissions", func(t *testing.T) {
		for _, user := range []apis.User{
			helper.OrgB.Admin, // Not a Grafana Admin
			helper.Org1.Editor,
			helper.Org1.Viewer,
		} {
			t.Run(fmt.Sprintf("with basic role_%s", user.Identity.GetOrgRole()), func(t *testing.T) {
				ctx := context.Background()
				userClient := helper.GetResourceClient(apis.ResourceClientArgs{
					User:      user,
					Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:       gvrUsers,
				})

				// Create the user
				_, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
				require.Error(t, err)
				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})
}

func doUserCRUDTestsUsingTheLegacyAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create user using legacy APIs and delete it using the new APIs", func(t *testing.T) {
		ctx := context.Background()
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrUsers,
		})

		legacyUserPayload := `{
			"name": "Legacy User 3",
			"email": "legacyuser3@example.com",
			"login": "legacyuser3",
			"password": "password123"
		}`

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/admin/users",
			Body:   []byte(legacyUserPayload),
		}, &user.User{})

		require.NotNil(t, rsp)
		require.Equal(t, 200, rsp.Response.StatusCode)
		require.NotEmpty(t, rsp.Result.UID)

		// Now try to fetch the user via the new API
		user, err := userClient.Resource.Get(context.Background(), rsp.Result.UID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, user)

		// Verify fetched user matches created user
		userSpec := user.Object["spec"].(map[string]interface{})
		require.Equal(t, "legacyuser3@example.com", userSpec["email"])
		require.Equal(t, "legacyuser3", userSpec["login"])
		require.Equal(t, "Legacy User 3", userSpec["name"])
		require.Equal(t, false, userSpec["provisioned"])

		// Verify metadata
		require.Equal(t, rsp.Result.UID, user.GetName())
		require.Equal(t, "default", user.GetNamespace())

		// Now delete the user using the legacy API
		deleteRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "DELETE",
			Path:   fmt.Sprintf("/api/admin/users/%d", rsp.Result.ID),
		}, &apis.AnyResource{})
		require.Equal(t, 200, deleteRsp.Response.StatusCode)

		// Verify deletion
		_, err = userClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}
