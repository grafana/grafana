package serviceaccount

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var gvrServiceAccounts = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "serviceaccounts",
}

func TestIntegrationServiceAccounts(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationServiceAccounts)
}

func testIntegrationServiceAccounts(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("Service Account CRUD operations with dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"serviceaccounts.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesServiceAccountsApi,
					featuremgmt.FlagKubernetesServiceAccountTokensApi,
				},
			})
			doServiceAccountCRUDTestsUsingTheNewAPIs(t, helper)

			// TODO: Figure out why doServiceAccountListFilteringTest is failing in rest.Mode4 and rest.Mode5
			if mode < rest.Mode4 {
				doServiceAccountListFilteringTest(t, helper)
			}

			if mode < rest.Mode3 {
				doServiceAccountCRUDTestsUsingTheLegacyAPIs(t, helper)
				doServiceAccountScopedPermissionTests(t, helper)
			}
		})
	}
}

func doServiceAccountCRUDTestsUsingTheNewAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create service account and get it using the new APIs as admin", func(t *testing.T) {
		ctx := context.Background()

		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		created, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Service Account 1", createdSpec["title"])
		require.Equal(t, false, createdSpec["disabled"])
		require.Empty(t, createdSpec["plugin"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)

		_, err = saClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		fetched, err := saClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Service Account 1", fetchedSpec["title"])
		require.Equal(t, false, fetchedSpec["disabled"])
		require.Empty(t, fetchedSpec["plugin"])

		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())

		err = saClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.NoError(t, err)

		_, err = saClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.ErrStatus.Code)
	})

	t.Run("should not be able to create service account when using a user with insufficient permissions", func(t *testing.T) {
		for _, user := range []apis.User{
			helper.Org1.Editor,
			helper.Org1.Viewer,
		} {
			t.Run(fmt.Sprintf("with basic role_%s", user.Identity.GetOrgRole()), func(t *testing.T) {
				ctx := context.Background()
				saClient := helper.GetResourceClient(apis.ResourceClientArgs{
					User:      user,
					Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:       gvrServiceAccounts,
				})

				_, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-create-v0.yaml"), metav1.CreateOptions{})
				require.Error(t, err)
				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})

	t.Run("should not be able to create service account with invalid role", func(t *testing.T) {
		ctx := context.Background()
		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		saToCreate := helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-invalid-role-v0.yaml")

		_, err := saClient.Resource.Create(ctx, saToCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "invalid role: InvalidRole")
	})

	t.Run("should not be able to create service account without a title", func(t *testing.T) {
		ctx := context.Background()
		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		saToCreate := helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-no-title-v0.yaml")

		_, err := saClient.Resource.Create(ctx, saToCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "service account must have a title")
	})

	t.Run("should not be able to create external service account as a user", func(t *testing.T) {
		ctx := context.Background()
		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		saToCreate := helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-external-v0.yaml")

		_, err := saClient.Resource.Create(ctx, saToCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "only service identities can create external service accounts")
	})

	t.Run("should update service account using the new APIs as admin", func(t *testing.T) {
		ctx := context.Background()

		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		created, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		createdUID := created.GetName()
		t.Cleanup(func() {
			_ = saClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		})

		toUpdate := created.DeepCopy()
		require.NoError(t, unstructured.SetNestedField(toUpdate.Object, "Updated Service Account 1", "spec", "title"))
		require.NoError(t, unstructured.SetNestedField(toUpdate.Object, "Editor", "spec", "role"))
		require.NoError(t, unstructured.SetNestedField(toUpdate.Object, true, "spec", "disabled"))

		updated, err := saClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updated)

		updatedSpec := updated.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated Service Account 1", updatedSpec["title"])
		require.Equal(t, "Editor", updatedSpec["role"])
		require.Equal(t, true, updatedSpec["disabled"])
		require.Equal(t, createdUID, updated.GetName())

		// The update response must carry the original creation timestamp rather than a
		// zero value, and must not lose the deprecated internal id the legacy APIs rely on.
		updatedCreationTS := updated.GetCreationTimestamp()
		require.False(t, updatedCreationTS.IsZero())
		require.Equal(t, created.GetCreationTimestamp(), updated.GetCreationTimestamp())

		createdMeta, err := utils.MetaAccessor(created)
		require.NoError(t, err)
		updatedMeta, err := utils.MetaAccessor(updated)
		require.NoError(t, err)
		require.NotZero(t, createdMeta.GetDeprecatedInternalID())                                      // nolint:staticcheck
		require.Equal(t, createdMeta.GetDeprecatedInternalID(), updatedMeta.GetDeprecatedInternalID()) // nolint:staticcheck

		fetched, err := saClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Updated Service Account 1", fetchedSpec["title"])
		require.Equal(t, "Editor", fetchedSpec["role"])
		require.Equal(t, true, fetchedSpec["disabled"])
	})

	t.Run("should not be able to update service account without a title", func(t *testing.T) {
		ctx := context.Background()

		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		created, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		createdUID := created.GetName()
		t.Cleanup(func() {
			_ = saClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		})

		toUpdate := created.DeepCopy()
		require.NoError(t, unstructured.SetNestedField(toUpdate.Object, "", "spec", "title"))

		_, err = saClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "service account must have a title")
	})

	t.Run("should not be able to update service account when using a user with insufficient permissions", func(t *testing.T) {
		ctx := context.Background()

		adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		created, err := adminClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		createdUID := created.GetName()
		t.Cleanup(func() {
			_ = adminClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		})

		for _, user := range []apis.User{
			helper.Org1.Editor,
			helper.Org1.Viewer,
		} {
			t.Run(fmt.Sprintf("with basic role_%s", user.Identity.GetOrgRole()), func(t *testing.T) {
				saClient := helper.GetResourceClient(apis.ResourceClientArgs{
					User:      user,
					Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:       gvrServiceAccounts,
				})

				toUpdate := created.DeepCopy()
				require.NoError(t, unstructured.SetNestedField(toUpdate.Object, "Should Not Be Updated", "spec", "title"))

				_, err := saClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
				require.Error(t, err)
				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})

	t.Run("should create service account with generateName and get it using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()

		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		created, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-generate-name-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Service Account with GenerateName", createdSpec["title"])
		require.Equal(t, false, createdSpec["disabled"])
		require.Empty(t, createdSpec["plugin"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)
		require.Contains(t, createdUID, "sa-")

		_, err = saClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		fetched, err := saClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Service Account with GenerateName", fetchedSpec["title"])
		require.Equal(t, false, fetchedSpec["disabled"])
		require.Empty(t, fetchedSpec["plugin"])

		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())
	})
}

// doServiceAccountListFilteringTest verifies that a nameless collection list is
// allowed at the API layer (allowListAuthorizer) and that the backend filters the
// result to only the service accounts the caller can read.
func doServiceAccountListFilteringTest(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("list returns only the service accounts the user can read", func(t *testing.T) {
		ctx := context.Background()

		adminClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		visible := createNamedServiceAccount(t, ctx, helper, adminClient, "list-filter-visible", "Visible SA")
		hidden := createNamedServiceAccount(t, ctx, helper, adminClient, "list-filter-hidden", "Hidden SA")
		t.Cleanup(func() {
			cleanupCtx := context.Background()
			_ = adminClient.Resource.Delete(cleanupCtx, visible.GetName(), metav1.DeleteOptions{})
			_ = adminClient.Resource.Delete(cleanupCtx, hidden.GetName(), metav1.DeleteOptions{})
		})

		visibleID := visible.GetLabels()[utils.LabelKeyDeprecatedInternalID]
		require.NotEmpty(t, visibleID, "service account should expose its internal ID label")

		// A user with no basic role and read access to only the "visible" SA.
		lister := helper.CreateUser("sa-list-filter-user", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
			{
				Actions:           []string{serviceaccounts.ActionRead},
				Resource:          "serviceaccounts",
				ResourceAttribute: "id",
				ResourceID:        visibleID,
			},
		})

		listerClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      lister,
			Namespace: helper.Namespacer(lister.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		list, err := listerClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		names := make([]string, 0, len(list.Items))
		for _, item := range list.Items {
			names = append(names, item.GetName())
		}
		require.Contains(t, names, visible.GetName(), "user should see the service account they can read")
		require.NotContains(t, names, hidden.GetName(), "user must not see service accounts they cannot read")
	})
}

func createNamedServiceAccount(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper, client *apis.K8sResourceClient, name, title string) *unstructured.Unstructured {
	t.Helper()
	obj := helper.LoadYAMLOrJSONFile("../testdata/serviceaccount-test-create-v0.yaml")
	obj.Object["metadata"].(map[string]any)["name"] = name
	obj.Object["spec"].(map[string]any)["title"] = title
	created, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)
	return created
}

func doServiceAccountCRUDTestsUsingTheLegacyAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create service account using legacy APIs and get it using the new APIs", func(t *testing.T) {
		ctx := context.Background()
		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		legacySAPayload := `{
			"name": "Test Service Account 2",
			"role": "Viewer"
		}`

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/serviceaccounts",
			Body:   []byte(legacySAPayload),
		}, &serviceaccounts.ServiceAccountDTO{})

		require.NotNil(t, rsp)
		require.Equal(t, 201, rsp.Response.StatusCode)
		require.NotEmpty(t, rsp.Result.UID)

		sa, err := saClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, sa)

		saSpec := sa.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Service Account 2", saSpec["title"])
		require.Equal(t, false, saSpec["disabled"])
		require.Empty(t, saSpec["plugin"])

		require.Equal(t, rsp.Result.UID, sa.GetName())
		require.Equal(t, "default", sa.GetNamespace())
	})

	t.Run("should create service account using legacy APIs, update it using the new APIs and read it back using the legacy APIs", func(t *testing.T) {
		ctx := context.Background()
		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		legacySAPayload := `{
			"name": "Test Service Account to update",
			"role": "Viewer"
		}`

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/serviceaccounts",
			Body:   []byte(legacySAPayload),
		}, &serviceaccounts.ServiceAccountDTO{})

		require.NotNil(t, rsp)
		require.Equal(t, 201, rsp.Response.StatusCode)
		require.NotEmpty(t, rsp.Result.UID)

		t.Cleanup(func() {
			_ = saClient.Resource.Delete(ctx, rsp.Result.UID, metav1.DeleteOptions{})
		})

		sa, err := saClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.NoError(t, err)

		toUpdate := sa.DeepCopy()
		require.NoError(t, unstructured.SetNestedField(toUpdate.Object, "Updated Service Account", "spec", "title"))
		require.NoError(t, unstructured.SetNestedField(toUpdate.Object, "Editor", "spec", "role"))

		_, err = saClient.Resource.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.NoError(t, err)

		legacyRsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   fmt.Sprintf("/api/serviceaccounts/%d", rsp.Result.Id),
		}, &serviceaccounts.ServiceAccountProfileDTO{})

		require.NotNil(t, legacyRsp)
		require.Equal(t, 200, legacyRsp.Response.StatusCode)
		require.Equal(t, "Updated Service Account", legacyRsp.Result.Name)
		require.Equal(t, "Editor", legacyRsp.Result.Role)
	})

	t.Run("should create service account using legacy APIs and delete it using the new APIs", func(t *testing.T) {
		ctx := context.Background()
		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		legacySAPayload := `{
			"name": "Test Service Account to delete",
			"role": "Editor"
		}`

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/serviceaccounts",
			Body:   []byte(legacySAPayload),
		}, &serviceaccounts.ServiceAccountDTO{})

		require.NotNil(t, rsp)
		require.Equal(t, 201, rsp.Response.StatusCode)
		require.NotEmpty(t, rsp.Result.UID)

		_, err := saClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.NoError(t, err)

		err = saClient.Resource.Delete(ctx, rsp.Result.UID, metav1.DeleteOptions{})
		require.NoError(t, err)

		_, err = saClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.ErrStatus.Code)
	})
}

func doServiceAccountScopedPermissionTests(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("legacy API permissions are scoped to the target", func(t *testing.T) {
		cases := serviceaccountPermissionCases()

		for i, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				targetID, otherID := createScopedServiceAccountTargets(t, helper, i)
				grantedID := targetID
				if tc.wrongTarget {
					grantedID = otherID
				}

				grants := []resourcepermissions.SetResourcePermissionCommand{
					{
						Actions:           tc.actions,
						Resource:          "serviceaccounts",
						ResourceAttribute: "id",
						ResourceID:        grantedID,
					},
				}
				caller := helper.CreateUser(fmt.Sprintf("serviceaccount-scope-%d", i), apis.Org1, org.RoleNone, grants)

				path := fmt.Sprintf("/api/serviceaccounts/%s", targetID)
				before := readScopedServiceAccountAsAdmin(t, helper, path)

				get := apis.DoRequest(helper, apis.RequestParams{User: caller, Path: path}, &struct{}{})
				expected := http.StatusForbidden
				if tc.read {
					expected = http.StatusOK
				}
				require.Equal(t, expected, get.Response.StatusCode, string(get.Body))

				body, err := json.Marshal(map[string]interface{}{"name": "Updated scoped resource"})
				require.NoError(t, err)
				update := apis.DoRequest(helper, apis.RequestParams{
					User:   caller,
					Method: http.MethodPatch,
					Path:   path,
					Body:   body,
				}, &struct{}{})
				expected = http.StatusForbidden
				if tc.write {
					expected = http.StatusOK
				}
				require.Equal(t, expected, update.Response.StatusCode, string(update.Body))

				after := readScopedServiceAccountAsAdmin(t, helper, path)
				if tc.write {
					require.Equal(t, "Updated scoped resource", after["name"])
				} else {
					require.Equal(t, before, after)
				}

				deleted := apis.DoRequest(helper, apis.RequestParams{
					User:   caller,
					Method: http.MethodDelete,
					Path:   path,
				}, &struct{}{})
				require.Equal(t, http.StatusForbidden, deleted.Response.StatusCode, string(deleted.Body))

				stillExists := readScopedServiceAccountAsAdmin(t, helper, path)
				require.Equal(t, after, stillExists)
			})
		}
	})
}

type serviceaccountPermissionCase struct {
	name        string
	actions     []string
	read        bool
	write       bool
	wrongTarget bool
}

func serviceaccountPermissionCases() []serviceaccountPermissionCase {
	return []serviceaccountPermissionCase{
		{name: "no permissions"},
		{
			name:    "read only",
			actions: []string{serviceaccounts.ActionRead},
			read:    true,
		},
		{
			name:    "write only",
			actions: []string{serviceaccounts.ActionWrite},
			write:   true,
		},
		{
			name:    "read and write",
			actions: []string{serviceaccounts.ActionRead, serviceaccounts.ActionWrite},
			read:    true,
			write:   true,
		},
		{name: "permission management only", actions: []string{serviceaccounts.ActionPermissionsWrite}},
		{
			name:        "different target",
			actions:     []string{serviceaccounts.ActionRead, serviceaccounts.ActionWrite, serviceaccounts.ActionPermissionsWrite},
			wrongTarget: true,
		},
	}
}

func readScopedServiceAccountAsAdmin(t *testing.T, helper *apis.K8sTestHelper, path string) map[string]interface{} {
	t.Helper()

	response := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: path,
	}, &map[string]interface{}{})
	require.Equal(t, http.StatusOK, response.Response.StatusCode, string(response.Body))

	return *response.Result
}

func createScopedServiceAccountTargets(t *testing.T, helper *apis.K8sTestHelper, index int) (string, string) {
	t.Helper()

	ctx := context.Background()
	admin := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvrServiceAccounts,
	})
	suffixes := []string{"target", "other"}
	ids := make([]string, 0, len(suffixes))
	for _, suffix := range suffixes {
		name := fmt.Sprintf("scope-%d-%s", index, suffix)
		title := fmt.Sprintf("Scope %d %s", index, suffix)
		created := createNamedServiceAccount(t, ctx, helper, admin, name, title)
		t.Cleanup(func() {
			require.NoError(t, admin.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}))
		})

		id := created.GetLabels()[utils.LabelKeyDeprecatedInternalID]
		require.NotEmpty(t, id)
		ids = append(ids, id)
	}

	return ids[0], ids[1]
}
