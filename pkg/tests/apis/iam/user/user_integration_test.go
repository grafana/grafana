package user

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUsers(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				RBACSingleOrganization: true,
				APIServerStorageType:   "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesUsersApi,
				},
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			doUserCRUDTestsUsingTheNewAPIs(t, helper)
			doUserListFilteringTest(t, helper)
			doHiddenUsersTests(t, helper)
			doUserFieldSelectorTests(t, helper)
			doUserStatusUpdateTests(t, helper)
			doDisplayTests(t, helper)
			doSelfTests(t, helper)

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
		created, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		// Verify creation response
		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "testuser1@example123", createdSpec["email"])
		require.Equal(t, "testuser1", createdSpec["login"])
		require.Equal(t, "Test User 1", createdSpec["title"])
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
		require.Equal(t, "testuser1@example123", fetchedSpec["email"])
		require.Equal(t, "testuser1", fetchedSpec["login"])
		require.Equal(t, "Test User 1", fetchedSpec["title"])
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
		created, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v1.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
		t.Cleanup(func() {
			_ = userClient.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
		})

		// Get the user to update
		createdUID := created.GetName()
		userToUpdate, err := userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)

		// Modify the user spec
		spec := userToUpdate.Object["spec"].(map[string]interface{})
		spec["title"] = "Updated Test User"
		spec["email"] = "updated.test.user@example"
		userToUpdate.Object["spec"] = spec

		// Update the user
		updated, err := userClient.Resource.Update(ctx, userToUpdate, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		// Verify the update response
		updatedSpec := updated.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated Test User", updatedSpec["title"])
		require.Equal(t, "updated.test.user@example", updatedSpec["email"])

		// Fetch again to confirm
		fetched, err := userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated Test User", fetchedSpec["title"])
		require.Equal(t, "updated.test.user@example", fetchedSpec["email"])

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
				_, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
				require.Error(t, err)
				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})

	t.Run("should not be able to create a user with a duplicate email", func(t *testing.T) {
		ctx := context.Background()
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Create the first user
		created, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-duplicate-email-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		// Attempt to create another user with the same email
		_, err = userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-duplicate-email-other.yaml"), metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(409), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "email 'testuser-email-1@example' is already taken")

		// Cleanup
		err = userClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("should not be able to create a user with a duplicate login", func(t *testing.T) {
		ctx := context.Background()
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Create the first user
		created, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-duplicate-login-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		// Attempt to create a second user with the same login
		_, err = userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-duplicate-login-other.yaml"), metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(409), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "login 'testuser-login-1' is already taken")

		// Cleanup
		err = userClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("should not be able to update a user with an existing email", func(t *testing.T) {
		ctx := context.Background()
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Create the first user
		user1, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, user1)

		// Create the second user
		user2, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v1.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, user2)

		// Get the user to update
		userToUpdate, err := userClient.Resource.Get(ctx, user2.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		// Modify the user spec to have the same email as user1
		spec := userToUpdate.Object["spec"].(map[string]interface{})
		user1Spec := user1.Object["spec"].(map[string]interface{})
		spec["email"] = user1Spec["email"]
		userToUpdate.Object["spec"] = spec

		// Attempt to update the user
		_, err = userClient.Resource.Update(ctx, userToUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(409), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "email 'testuser1@example123' is already taken")

		// Cleanup
		err = userClient.Resource.Delete(ctx, user1.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
		err = userClient.Resource.Delete(ctx, user2.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("should not be able to update a user with an existing login", func(t *testing.T) {
		ctx := context.Background()
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Create the first user
		user1, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, user1)

		// Create the second user
		user2, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v1.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, user2)

		// Get the user to update
		userToUpdate, err := userClient.Resource.Get(ctx, user2.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		// Modify the user spec to have the same login as user1
		spec := userToUpdate.Object["spec"].(map[string]interface{})
		user1Spec := user1.Object["spec"].(map[string]interface{})
		spec["login"] = user1Spec["login"]
		userToUpdate.Object["spec"] = spec

		// Attempt to update the user
		_, err = userClient.Resource.Update(ctx, userToUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(409), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "login 'testuser1' is already taken")

		// Cleanup
		err = userClient.Resource.Delete(ctx, user1.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
		err = userClient.Resource.Delete(ctx, user2.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
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
			"email": "legacyuser3@example",
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
		require.Equal(t, "legacyuser3@example", userSpec["email"])
		require.Equal(t, "legacyuser3", userSpec["login"])
		require.Equal(t, "Legacy User 3", userSpec["title"])
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

// doUserListFilteringTest verifies that a nameless collection list is allowed at
// the API layer (allowListAuthorizer) even for a caller that cannot read every
// user, and that the backend filters the result by the caller's permissions.
// User read is org-global (all-or-nothing; there is no per-user resource
// permission), so a user without users:read gets a 200 filtered result rather
// than a 403. Admin listing is already covered by the CRUD, hidden-user and
// field-selector tests.
func doUserListFilteringTest(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("list is allowed at the API layer and filtered by permissions", func(t *testing.T) {
		ctx := context.Background()

		adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		target := helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml")
		target.Object["metadata"].(map[string]any)["name"] = "listfiltertarget"
		target.Object["spec"].(map[string]any)["login"] = "listfiltertarget"
		target.Object["spec"].(map[string]any)["email"] = "listfiltertarget@example.com"
		created, err := adminClient.Resource.Create(ctx, target, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
		t.Cleanup(func() {
			_ = adminClient.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
		})

		// A user with no basic role has no users:read permission.
		lister := helper.CreateUser("user-list-filter-user", apis.Org1, org.RoleNone, nil)
		listerClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      lister,
			Namespace: helper.Namespacer(lister.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// The nameless list must succeed (200) rather than 403, and must not
		// surface a user the caller has no permission to read.
		list, err := listerClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		names := make([]string, 0, len(list.Items))
		for _, item := range list.Items {
			names = append(names, item.GetName())
		}
		require.NotContains(t, names, created.GetName(), "user without users:read must not see other users")
	})
}

func doHiddenUsersTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should hide users from the hidden users list on Get and List", func(t *testing.T) {
		ctx := context.Background()

		const hiddenLogin = "hidden-integration-user"

		adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Create the user before marking it as hidden so BeforeCreate does not block it.
		obj := helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml")
		spec := obj.Object["spec"].(map[string]interface{})
		spec["login"] = hiddenLogin
		spec["email"] = hiddenLogin + "@example.com"
		obj.Object["spec"] = spec

		created, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		createdUID := created.GetName()

		// Register the hidden login in the live Cfg so UserFilter picks it up.
		helper.GetEnv().Cfg.HiddenUsers[hiddenLogin] = struct{}{}
		// Cleanup: remove from hidden list first so that Delete can succeed.
		t.Cleanup(func() {
			delete(helper.GetEnv().Cfg.HiddenUsers, hiddenLogin)
			_ = adminClient.Resource.Delete(context.Background(), createdUID, metav1.DeleteOptions{})
		})

		// Get should return 404 when the requester is not the hidden user.
		_, err = adminClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.ErrStatus.Code)

		// List should not include the hidden user.
		list, err := adminClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		for _, item := range list.Items {
			itemSpec := item.Object["spec"].(map[string]interface{})
			require.NotEqual(t, hiddenLogin, itemSpec["login"])
		}

		// Update should return 403 for a hidden user.
		userToUpdate := created.DeepCopy()
		updateSpec := userToUpdate.Object["spec"].(map[string]interface{})
		updateSpec["title"] = "Updated Title"
		userToUpdate.Object["spec"] = updateSpec
		_, err = adminClient.Resource.Update(ctx, userToUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "operation not permitted")

		// Delete should return 403 for a hidden user.
		err = adminClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.Error(t, err)
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "operation not permitted")
	})

	t.Run("should not be able to create a user whose login is in the hidden users list", func(t *testing.T) {
		ctx := context.Background()

		const hiddenLogin = "hidden-create-blocked-user"

		adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		helper.GetEnv().Cfg.HiddenUsers[hiddenLogin] = struct{}{}
		t.Cleanup(func() {
			delete(helper.GetEnv().Cfg.HiddenUsers, hiddenLogin)
		})

		obj := helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml")
		spec := obj.Object["spec"].(map[string]interface{})
		spec["login"] = hiddenLogin
		spec["email"] = hiddenLogin + "@example.com"
		obj.Object["spec"] = spec

		_, err := adminClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "operation not permitted")
	})
}

func doUserFieldSelectorTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should list users using field selectors", func(t *testing.T) {
		ctx := context.Background()

		var userNames []string

		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		createUser := func(name string, email string, login string) {
			obj := helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml")
			obj.SetName(name)

			spec := obj.Object["spec"].(map[string]interface{})
			spec["email"] = email
			spec["login"] = login

			created, err := userClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
			require.NoError(t, err)
			userNames = append(userNames, created.GetName())
		}

		createUser("fs-user-1", "fs-user1@example.com", "fs-user1")
		createUser("fs-user-2", "fs-user2@example.com", "fs-user2")
		createUser("fs-user-3", "fs-user3@example.com", "fs-user3")

		t.Cleanup(func() {
			cleanupCtx := context.Background()
			for _, name := range userNames {
				_ = userClient.Resource.Delete(cleanupCtx, name, metav1.DeleteOptions{})
			}
		})

		// Select by spec.email — should return exactly 1 user
		listByEmail, err := userClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.email=fs-user2@example.com",
		})
		require.NoError(t, err)
		require.Len(t, listByEmail.Items, 1)
		emailSpec := listByEmail.Items[0].Object["spec"].(map[string]interface{})
		require.Equal(t, "fs-user2@example.com", emailSpec["email"])
		require.Equal(t, "fs-user2", emailSpec["login"])

		// Select by spec.login — should return exactly 1 user
		listByLogin, err := userClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.login=fs-user3",
		})
		require.NoError(t, err)
		require.Len(t, listByLogin.Items, 1)
		loginSpec := listByLogin.Items[0].Object["spec"].(map[string]interface{})
		require.Equal(t, "fs-user3@example.com", loginSpec["email"])
		require.Equal(t, "fs-user3", loginSpec["login"])

		// Select by a non-existent email — should return empty list
		listByUnknownEmail, err := userClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.email=does-not-exist@example.com",
		})
		require.NoError(t, err)
		require.Empty(t, listByUnknownEmail.Items)
	})
}

func doUserStatusUpdateTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should update lastSeenAt via status subresource with the provided value", func(t *testing.T) {
		ctx := context.Background()

		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		// Create a user
		created, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)
		createdUID := created.GetName()
		t.Cleanup(func() {
			_ = userClient.Resource.Delete(context.Background(), createdUID, metav1.DeleteOptions{})
		})

		// Get the user and check initial lastSeenAt (should be old — set to 10 years ago on creation)
		fetched, err := userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		status := fetched.Object["status"].(map[string]interface{})
		initialLastSeenAt := toInt64(t, status["lastSeenAt"])

		initialTime := time.Unix(initialLastSeenAt, 0)
		require.True(t, initialTime.Before(time.Now().Add(-1*time.Hour)),
			"expected initial lastSeenAt to be in the past, got %v", initialTime)

		// Use a specific timestamp — the API should store exactly this value, not time.Now()
		wantLastSeenAt := time.Date(2025, 3, 15, 12, 30, 0, 0, time.UTC).Unix()

		// Update status subresource with the chosen timestamp
		statusObj := fetched.DeepCopy()
		statusMap := statusObj.Object["status"].(map[string]interface{})
		statusMap["lastSeenAt"] = wantLastSeenAt
		statusObj.Object["status"] = statusMap

		updated, err := userClient.Resource.UpdateStatus(ctx, statusObj, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		// Fetch the user and verify the exact value was persisted
		fetchedAfter, err := userClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		statusAfter := fetchedAfter.Object["status"].(map[string]interface{})
		gotLastSeenAt := toInt64(t, statusAfter["lastSeenAt"])
		require.Equal(t, wantLastSeenAt, gotLastSeenAt,
			"lastSeenAt should match the value provided in the status update")
	})
}

func doDisplayTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("display endpoint returns identity info for known users and magic keys", func(t *testing.T) {
		adminID, err := identity.UserIdentifier(helper.Org1.Admin.Identity.GetID())
		require.NoError(t, err)
		adminUID := helper.Org1.Admin.Identity.GetUID()
		adminIDKey := strconv.FormatInt(adminID, 10)

		q := url.Values{}
		q.Add("key", adminUID)
		q.Add("key", adminIDKey)
		q.Add("key", "0")
		q.Add("key", "anonymous:")
		q.Add("key", "api-key:my-key")
		q.Add("key", "bogus:1")

		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/display?%s", q.Encode())

		res := &iam.DisplayList{}
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, res)

		require.Equal(t, 200, rsp.Response.StatusCode)
		require.ElementsMatch(t, []string{adminUID, adminIDKey, "0", "anonymous:", "api-key:my-key", "bogus:1"}, res.Keys)
		require.Equal(t, []string{"bogus:1"}, res.InvalidKeys)

		var sawAdmin, sawSystemAdmin, sawAnonymous, sawAPIKey bool
		for _, d := range res.Items {
			switch {
			case d.Identity.Type == authlib.TypeUser && d.InternalID == adminID:
				sawAdmin = true
			case d.Identity.Type == authlib.TypeUser && d.Identity.Name == "0":
				require.Equal(t, "System admin", d.DisplayName)
				sawSystemAdmin = true
			case d.Identity.Type == authlib.TypeAnonymous:
				require.Equal(t, "Anonymous", d.DisplayName)
				sawAnonymous = true
			case d.Identity.Type == authlib.TypeAPIKey:
				require.Equal(t, "API Key", d.DisplayName)
				require.Equal(t, "my-key", d.Identity.Name)
				sawAPIKey = true
			}
		}
		require.True(t, sawAdmin, "admin user should be returned for UID/ID lookup")
		require.True(t, sawSystemAdmin)
		require.True(t, sawAnonymous)
		require.True(t, sawAPIKey)
	})

	t.Run("display endpoint resolves service accounts with the service-account type", func(t *testing.T) {
		sa := helper.Org1.AdminServiceAccount
		q := url.Values{}
		q.Add("key", strconv.FormatInt(sa.Id, 10))

		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/display?%s", q.Encode())

		res := &iam.DisplayList{}
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   path,
		}, res)

		require.Equal(t, 200, rsp.Response.StatusCode)
		require.Empty(t, res.InvalidKeys)
		require.Len(t, res.Items, 1)
		require.Equal(t, authlib.TypeServiceAccount, res.Items[0].Identity.Type)
		require.Equal(t, sa.Id, res.Items[0].InternalID)
	})
}

func doSelfTests(t *testing.T, helper *apis.K8sTestHelper) {
	// selfPath is the "who am I" endpoint. A literal `~` token must not be
	// shadowed by the users/{name} resource route.
	const selfPath = "/apis/iam.grafana.app/v0alpha1/namespaces/default/users/~"

	assertSelf := func(t *testing.T, caller apis.User) {
		t.Helper()

		res := &iam.Display{}
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   caller,
			Method: "GET",
			Path:   selfPath,
		}, res)
		require.Equal(t, 200, rsp.Response.StatusCode)

		wantID, err := identity.UserIdentifier(caller.Identity.GetID())
		require.NoError(t, err)

		require.Equal(t, authlib.TypeUser, res.Identity.Type)
		require.Equal(t, caller.Identity.GetRawIdentifier(), res.Identity.Name)
		require.Equal(t, caller.Identity.GetName(), res.DisplayName)
		require.NotEmpty(t, res.DisplayName)
		require.NotEmpty(t, res.AvatarURL)
		require.Contains(t, res.AvatarURL, "/avatar/")
		require.Equal(t, wantID, res.InternalID)
	}

	t.Run("self endpoint returns the calling user's display info", func(t *testing.T) {
		assertSelf(t, helper.Org1.Admin)
	})

	t.Run("self endpoint works for a non-admin reading their own info", func(t *testing.T) {
		assertSelf(t, helper.Org1.Viewer)
	})
}

// toInt64 converts a value from unstructured JSON (which may be float64 or int64) to int64.
func toInt64(t *testing.T, v interface{}) int64 {
	t.Helper()
	switch n := v.(type) {
	case int64:
		return n
	case float64:
		return int64(n)
	default:
		t.Fatalf("expected numeric type, got %T", v)
		return 0
	}
}
