package authinfo

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/iam/authinfo"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationAuthInfo(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Mode5 is excluded: it serves straight from unified storage, bypassing LegacyStore
	// (and every domain rule enforced there) since nothing populates that store yet.
	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode3}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				RBACSingleOrganization: true,
				APIServerStorageType:   "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"authinfos.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesUsersApi,
					featuremgmt.FlagKubernetesAuthInfoApi,
				},
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			doAuthInfoCRUDTestsUsingTheNewAPIs(t, helper)
			doAuthInfoAuthzTests(t, helper)
			doAuthInfoListRequiresFieldSelectorTest(t, helper)
			doAuthInfoDeleteUnsupportedTests(t, helper)
			doAuthInfoUserDeleteCascadeTest(t, helper)
		})
	}
}

func doAuthInfoCRUDTestsUsingTheNewAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create, get, list and update authinfo using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()
		userUID := createTestUser(t, helper, "authinfo-crud-user", "authinfo-crud-user@example.com")

		authInfoClient := authInfoResourceClient(helper, helper.Org1.Admin)

		toCreate := createAuthInfoObject(helper, userUID, "ldap", "cn=test,dc=example,dc=com")
		created, err := authInfoClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		// The object name is deterministic: "<userUID>.<authModule>".
		expectedName := authinfo.EncodeName(userUID, "ldap")
		require.Equal(t, expectedName, created.GetName())

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, userUID, createdSpec["userRef"].(map[string]interface{})["name"])
		require.Equal(t, "ldap", createdSpec["authModule"])
		require.Equal(t, "cn=test,dc=example,dc=com", createdSpec["authID"])

		fetched, err := authInfoClient.Resource.Get(ctx, expectedName, metav1.GetOptions{})
		require.NoError(t, err)
		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "cn=test,dc=example,dc=com", fetchedSpec["authID"])

		list, err := authInfoClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: fmt.Sprintf("spec.userRef.name=%s", userUID),
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, expectedName, list.Items[0].GetName())

		toUpdate := fetched.DeepCopy()
		toUpdate.Object["spec"].(map[string]interface{})["authID"] = "cn=updated,dc=example,dc=com"
		updated, err := authInfoClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.NoError(t, err)
		updatedSpec := updated.Object["spec"].(map[string]interface{})
		require.Equal(t, "cn=updated,dc=example,dc=com", updatedSpec["authID"])

		fetchedAfter, err := authInfoClient.Resource.Get(ctx, expectedName, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "cn=updated,dc=example,dc=com", fetchedAfter.Object["spec"].(map[string]interface{})["authID"])
	})

	t.Run("should not create authinfo for a non-existent user", func(t *testing.T) {
		ctx := context.Background()
		authInfoClient := authInfoResourceClient(helper, helper.Org1.Admin)

		toCreate := createAuthInfoObject(helper, "non-existent-user", "ldap", "cn=test,dc=example,dc=com")
		_, err := authInfoClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
	})

	t.Run("should not create a duplicate authinfo for the same user and auth module", func(t *testing.T) {
		ctx := context.Background()
		userUID := createTestUser(t, helper, "authinfo-dup-user", "authinfo-dup-user@example.com")
		authInfoClient := authInfoResourceClient(helper, helper.Org1.Admin)

		toCreate := createAuthInfoObject(helper, userUID, "ldap", "cn=test,dc=example,dc=com")
		created, err := authInfoClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		_, err = authInfoClient.Resource.Create(ctx, createAuthInfoObject(helper, userUID, "ldap", "cn=other,dc=example,dc=com"), metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(409), statusErr.ErrStatus.Code)
	})

	t.Run("should not update authinfo with a userRef or authModule change", func(t *testing.T) {
		ctx := context.Background()
		userUID := createTestUser(t, helper, "authinfo-immutable-user", "authinfo-immutable-user@example.com")
		otherUserUID := createTestUser(t, helper, "authinfo-immutable-other-user", "authinfo-immutable-other-user@example.com")
		authInfoClient := authInfoResourceClient(helper, helper.Org1.Admin)

		created, err := authInfoClient.Resource.Create(ctx, createAuthInfoObject(helper, userUID, "ldap", "cn=test,dc=example,dc=com"), metav1.CreateOptions{})
		require.NoError(t, err)

		toUpdate := created.DeepCopy()
		toUpdate.Object["spec"].(map[string]interface{})["userRef"].(map[string]interface{})["name"] = otherUserUID
		_, err = authInfoClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "immutable")

		toUpdate = created.DeepCopy()
		toUpdate.Object["spec"].(map[string]interface{})["authModule"] = "oauth_github"
		_, err = authInfoClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "immutable")
	})
}

func doAuthInfoAuthzTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should not be able to access authinfo when using a user with insufficient permissions", func(t *testing.T) {
		ctx := context.Background()
		userUID := createTestUser(t, helper, "authinfo-authz-user", "authinfo-authz-user@example.com")

		adminClient := authInfoResourceClient(helper, helper.Org1.Admin)
		created, err := adminClient.Resource.Create(ctx, createAuthInfoObject(helper, userUID, "ldap", "cn=test,dc=example,dc=com"), metav1.CreateOptions{})
		require.NoError(t, err)

		for _, u := range []apis.User{
			helper.Org1.Editor,
			helper.Org1.Viewer,
			helper.OrgB.Admin, // Org admin, but not a Grafana admin
		} {
			t.Run(fmt.Sprintf("with basic role_%s", u.Identity.GetOrgRole()), func(t *testing.T) {
				authInfoClient := authInfoResourceClient(helper, u)

				_, err := authInfoClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
				require.Error(t, err)
				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)

				_, err = authInfoClient.Resource.Create(ctx, createAuthInfoObject(helper, userUID, "oauth_github", "some-id"), metav1.CreateOptions{})
				require.Error(t, err)
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})
}

func doAuthInfoListRequiresFieldSelectorTest(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should reject list without a spec.userRef.name field selector", func(t *testing.T) {
		ctx := context.Background()
		authInfoClient := authInfoResourceClient(helper, helper.Org1.Admin)

		_, err := authInfoClient.Resource.List(ctx, metav1.ListOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "spec.userRef.name")
	})
}

// doAuthInfoDeleteUnsupportedTests: deleting a single auth link isn't wired
// up yet, so Delete/DeleteCollection deliberately return 405.
func doAuthInfoDeleteUnsupportedTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("delete and deleteCollection are not supported", func(t *testing.T) {
		ctx := context.Background()
		userUID := createTestUser(t, helper, "authinfo-delete-user", "authinfo-delete-user@example.com")
		authInfoClient := authInfoResourceClient(helper, helper.Org1.Admin)

		created, err := authInfoClient.Resource.Create(ctx, createAuthInfoObject(helper, userUID, "ldap", "cn=test,dc=example,dc=com"), metav1.CreateOptions{})
		require.NoError(t, err)

		err = authInfoClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(405), statusErr.ErrStatus.Code)

		err = authInfoClient.Resource.DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{
			FieldSelector: fmt.Sprintf("spec.userRef.name=%s", userUID),
		})
		require.Error(t, err)
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(405), statusErr.ErrStatus.Code)
	})
}

// doAuthInfoUserDeleteCascadeTest checks whether deleting a user through the
// new User API also removes its user_auth row.
func doAuthInfoUserDeleteCascadeTest(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("deleting the user via the new API removes its user_auth row", func(t *testing.T) {
		ctx := context.Background()
		userUID := createTestUser(t, helper, "authinfo-cascade-user", "authinfo-cascade-user@example.com")

		authInfoClient := authInfoResourceClient(helper, helper.Org1.Admin)
		authID := "cascade-test-" + userUID
		_, err := authInfoClient.Resource.Create(ctx, createAuthInfoObject(helper, userUID, "ldap", authID), metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, int64(1), countUserAuthRowsByAuthID(t, helper, authID), "sanity check: the row should exist right after creation")

		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})
		err = userClient.Resource.Delete(ctx, userUID, metav1.DeleteOptions{})
		require.NoError(t, err)

		require.Equal(t, int64(0), countUserAuthRowsByAuthID(t, helper, authID), "user_auth row should be gone once its user is deleted")
	})
}

func countUserAuthRowsByAuthID(t *testing.T, helper *apis.K8sTestHelper, authID string) int64 {
	t.Helper()
	var count int64
	err := helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		n, err := sess.Table("user_auth").Where("auth_id = ?", authID).Count()
		count = n
		return err
	})
	require.NoError(t, err)
	return count
}

func authInfoResourceClient(helper *apis.K8sTestHelper, user apis.User) *apis.K8sResourceClient {
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User:      user,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrAuthInfo,
	})
}

// createTestUser creates a user via the new User API and registers its deletion as cleanup.
func createTestUser(t *testing.T, helper *apis.K8sTestHelper, login string, email string) string {
	t.Helper()
	ctx := context.Background()

	userClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrUsers,
	})

	obj := helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml")
	obj.SetName(login)
	spec := obj.Object["spec"].(map[string]interface{})
	spec["login"] = login
	spec["email"] = email
	obj.Object["spec"] = spec

	created, err := userClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)
	userUID := created.GetName()

	t.Cleanup(func() {
		_ = userClient.Resource.Delete(context.Background(), userUID, metav1.DeleteOptions{})
	})

	return userUID
}

// createAuthInfoObject builds an AuthInfo object with its deterministic name pre-populated.
func createAuthInfoObject(helper *apis.K8sTestHelper, userUID, authModule, authID string) *unstructured.Unstructured {
	obj := helper.LoadYAMLOrJSONFile("../testdata/authinfo-test-create-v0.yaml")
	obj.SetName(authinfo.EncodeName(userUID, authModule))
	obj.Object["spec"].(map[string]interface{})["userRef"].(map[string]interface{})["name"] = userUID
	obj.Object["spec"].(map[string]interface{})["authModule"] = authModule
	obj.Object["spec"].(map[string]interface{})["authID"] = authID
	return obj
}
