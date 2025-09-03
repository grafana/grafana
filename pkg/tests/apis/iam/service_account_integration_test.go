package identity

import (
	"context"
	"fmt"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var gvrServiceAccounts = schema.GroupVersionResource{
	Group:    "iam.grafana.app",
	Version:  "v0alpha1",
	Resource: "serviceaccounts",
}

func TestIntegrationServiceAccounts(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// TODO: Figure out why rest.Mode4 is failing
	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3}
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
					featuremgmt.FlagKubernetesAuthnMutation,
				},
			})
			doServiceAccountCRUDTestsUsingTheNewAPIs(t, helper)

			if mode < 3 {
				doServiceAccountCRUDTestsUsingTheLegacyAPIs(t, helper)
			}
		})
	}
}

func doServiceAccountCRUDTestsUsingTheNewAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create service account and get it using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()

		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		created, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/serviceaccount-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Service Account 1", createdSpec["title"])
		require.Equal(t, "sa-1-test-service-account-1", createdSpec["login"]) // Login is auto-generated
		require.Equal(t, false, createdSpec["disabled"])
		require.Equal(t, false, createdSpec["external"])
		require.Regexp(t, `/avatar/\w{32}`, createdSpec["avatarUrl"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)

		_, err = saClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		fetched, err := saClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Service Account 1", fetchedSpec["title"])
		require.Equal(t, "sa-1-test-service-account-1", fetchedSpec["login"]) // Login is auto-generated
		require.Equal(t, false, fetchedSpec["disabled"])
		require.Equal(t, false, fetchedSpec["external"])
		require.Regexp(t, `/avatar/\w{32}`, createdSpec["avatarUrl"])

		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())
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

				_, err := saClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/serviceaccount-test-create-v0.yaml"), metav1.CreateOptions{})
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

		saToCreate := helper.LoadYAMLOrJSONFile("testdata/serviceaccount-test-invalid-role-v0.yaml")

		_, err := saClient.Resource.Create(ctx, saToCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "invalid role: InvalidRole")
	})

	t.Run("should not be able to create service account with higher role than the user", func(t *testing.T) {
		ctx := context.Background()

		editorWithSACreate := helper.CreateUser("custom-editor", apis.Org1, org.RoleEditor,
			[]resourcepermissions.SetResourcePermissionCommand{
				{Actions: []string{serviceaccounts.ActionCreate}},
			})

		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      editorWithSACreate,
			Namespace: helper.Namespacer(editorWithSACreate.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		saToCreate := helper.LoadYAMLOrJSONFile("testdata/serviceaccount-test-higher-role-v0.yaml")

		_, err := saClient.Resource.Create(ctx, saToCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "can not assign a role higher than user's role")
	})

	t.Run("should not be able to create service account without a title", func(t *testing.T) {
		ctx := context.Background()
		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrServiceAccounts,
		})

		saToCreate := helper.LoadYAMLOrJSONFile("testdata/serviceaccount-test-no-title-v0.yaml")

		_, err := saClient.Resource.Create(ctx, saToCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "service account must have a title")
	})
}

func doServiceAccountCRUDTestsUsingTheLegacyAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create service account using legacy APIs and get it using the new APIs", func(t *testing.T) {
		ctx := context.Background()
		saClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvrServiceAccounts,
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
		require.Equal(t, false, saSpec["external"])
		require.Regexp(t, `/avatar/\w{32}`, saSpec["avatarUrl"])

		require.Equal(t, rsp.Result.UID, sa.GetName())
		require.Equal(t, "default", sa.GetNamespace())
	})
}
