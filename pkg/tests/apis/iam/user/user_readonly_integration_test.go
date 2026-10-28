package user

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apiserver"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUsersReadOnly(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Parallel()

	helper := newTestEnvironment(t, apiserver.Options{
		Configure: func(cfg *setting.Cfg) {
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				"users.iam.grafana.app": {
					DualWriterMode: rest.Mode0,
				},
			}
		},
		FeatureFlags: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesUsersReadApi,
			featuremgmt.FlagKubernetesTeamsApi,
		},
	})

	ctx := context.Background()
	userClient := helper.GetResourceClient(t, apiserver.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Org1.Admin.Identity.Namespace,
		GVR:       gvrUsers,
	})

	// Users created by the test helper through the legacy user service.
	list, err := userClient.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.NotEmpty(t, list.Items)
	existing := list.Items[0]

	t.Run("discovery only advertises read verbs", func(t *testing.T) {
		client, err := discovery.NewDiscoveryClientForConfig(helper.ClientConfig(helper.Org1.Admin))
		require.NoError(t, err)
		resources, err := client.ServerResourcesForGroupVersion(gvrUsers.GroupVersion().String())
		require.NoError(t, err)

		var verbs []string
		var hasStatus bool
		for _, r := range resources.APIResources {
			switch r.Name {
			case "users":
				verbs = r.Verbs
			case "users/status":
				hasStatus = true
			}
		}
		slices.Sort(verbs)
		require.Equal(t, []string{"get", "list", "watch"}, verbs)
		require.False(t, hasStatus, "status subresource should not be registered")
	})

	t.Run("get returns the user", func(t *testing.T) {
		fetched, err := userClient.Get(ctx, existing.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, existing.GetName(), fetched.GetName())
	})

	t.Run("search returns users", func(t *testing.T) {
		res := searchUsers(t, helper, "")
		require.NotEmpty(t, res.Hits)
	})

	t.Run("teams subresource is readable", func(t *testing.T) {
		rsp := apiserver.DoRequest(t, helper.Environment, apiserver.RequestParams{
			User:   helper.Org1.Admin,
			Method: "GET",
			Path:   fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/users/%s/teams", existing.GetName()),
		}, &map[string]any{})
		require.Equal(t, 200, rsp.Response.StatusCode)
	})

	t.Run("create is not allowed", func(t *testing.T) {
		_, err := userClient.Create(ctx, apiserver.LoadYAMLOrJSONFile(t, "../testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
		require.True(t, errors.IsMethodNotSupported(err), "unexpected error: %v", err)
	})

	t.Run("update is not allowed", func(t *testing.T) {
		toUpdate := existing.DeepCopy()
		toUpdate.Object["spec"].(map[string]any)["title"] = "Updated"
		_, err := userClient.Update(ctx, toUpdate, metav1.UpdateOptions{})
		require.True(t, errors.IsMethodNotSupported(err), "unexpected error: %v", err)
	})

	t.Run("patch is not allowed", func(t *testing.T) {
		_, err := userClient.Patch(ctx, existing.GetName(), types.MergePatchType, []byte(`{"spec":{"title":"Patched"}}`), metav1.PatchOptions{})
		require.True(t, errors.IsMethodNotSupported(err), "unexpected error: %v", err)
	})

	t.Run("delete is not allowed", func(t *testing.T) {
		err := userClient.Delete(ctx, existing.GetName(), metav1.DeleteOptions{})
		require.True(t, errors.IsMethodNotSupported(err), "unexpected error: %v", err)

		_, err = userClient.Get(ctx, existing.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
	})

	t.Run("status subresource is not served", func(t *testing.T) {
		_, err := userClient.UpdateStatus(ctx, existing.DeepCopy(), metav1.UpdateOptions{})
		require.True(t, errors.IsNotFound(err), "unexpected error: %v", err)
	})

	t.Run("non-admin access", func(t *testing.T) {
		alpha := createUser(t, helper, "alpha-authz", org.RoleViewer, nil)
		beta := createUser(t, helper, "beta-authz", org.RoleViewer, nil)
		alphaID, err := alpha.Identity.GetInternalID()
		require.NoError(t, err)
		betaID, err := beta.Identity.GetInternalID()
		require.NoError(t, err)

		// Resource names are the user UIDs, which the legacy user service generates.
		var alphaName, betaName string
		all, err := userClient.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		for _, item := range all.Items {
			switch login, _, _ := unstructured.NestedString(item.Object, "spec", "login"); login {
			case "alpha-authz":
				alphaName = item.GetName()
			case "beta-authz":
				betaName = item.GetName()
			}
		}
		require.NotEmpty(t, alphaName)
		require.NotEmpty(t, betaName)

		// A user with no basic role holds no users permissions at all.
		noPerms := createUser(t, helper, "no-perms-authz", org.RoleNone, nil)
		// A user with no basic role whose only grant is org.users:read on alpha.
		scoped := createUser(t, helper, "scoped-authz", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{{
			Actions:           []string{accesscontrol.ActionOrgUsersRead},
			Resource:          "users",
			ResourceAttribute: "id",
			ResourceID:        strconv.FormatInt(alphaID, 10),
		}})

		clientFor := func(u apiserver.User, ns string) dynamic.ResourceInterface {
			return helper.GetResourceClient(t, apiserver.ResourceClientArgs{User: u, Namespace: ns, GVR: gvrUsers})
		}
		orgNS := helper.Org1.Admin.Identity.Namespace

		listNames := func(t *testing.T, c dynamic.ResourceInterface, opts metav1.ListOptions) []string {
			t.Helper()
			l, err := c.List(ctx, opts)
			require.NoError(t, err)
			names := make([]string, 0, len(l.Items))
			for _, item := range l.Items {
				names = append(names, item.GetName())
			}
			return names
		}

		searchLogins := func(t *testing.T, u apiserver.User, ns string) (int, []string) {
			t.Helper()
			rsp := apiserver.DoRequest(t, helper.Environment, apiserver.RequestParams{
				User:   u,
				Method: "GET",
				Path:   fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchUsers?limit=100", ns),
			}, &iamv0.GetSearchUsersResponse{})
			if rsp.Result == nil {
				return rsp.Response.StatusCode, nil
			}
			logins := make([]string, 0, len(rsp.Result.Hits))
			for _, h := range rsp.Result.Hits {
				logins = append(logins, h.Login)
			}
			return rsp.Response.StatusCode, logins
		}

		t.Run("admin sees both users", func(t *testing.T) {
			names := listNames(t, userClient, metav1.ListOptions{})
			require.Contains(t, names, alphaName)
			require.Contains(t, names, betaName)

			status, logins := searchLogins(t, helper.Org1.Admin, orgNS)
			require.Equal(t, 200, status)
			require.Contains(t, logins, "alpha-authz")
			require.Contains(t, logins, "beta-authz")
		})

		t.Run("user without permissions sees no other users", func(t *testing.T) {
			c := clientFor(noPerms, orgNS)

			names := listNames(t, c, metav1.ListOptions{})
			require.NotContains(t, names, alphaName)
			require.NotContains(t, names, betaName)

			_, err := c.Get(ctx, alphaName, metav1.GetOptions{})
			require.True(t, errors.IsForbidden(err), "unexpected error: %v", err)

			status, logins := searchLogins(t, noPerms, orgNS)
			if status == 200 {
				require.NotContains(t, logins, "alpha-authz")
				require.NotContains(t, logins, "beta-authz")
			} else {
				require.Equal(t, 403, status)
			}
		})

		t.Run("scoped user only sees the user they were granted", func(t *testing.T) {
			c := clientFor(scoped, orgNS)

			names := listNames(t, c, metav1.ListOptions{})
			require.Contains(t, names, alphaName)
			require.NotContains(t, names, betaName)

			got, err := c.Get(ctx, alphaName, metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, alphaName, got.GetName())

			_, err = c.Get(ctx, betaName, metav1.GetOptions{})
			require.True(t, errors.IsForbidden(err), "unexpected error: %v", err)

			status, logins := searchLogins(t, scoped, orgNS)
			require.Equal(t, 200, status)
			require.Contains(t, logins, "alpha-authz")
			require.NotContains(t, logins, "beta-authz")
			require.NotContains(t, logins, helper.Org1.Admin.Identity.GetLogin())
		})

		t.Run("selectors cannot be used to reach a user the caller cannot read", func(t *testing.T) {
			c := clientFor(scoped, orgNS)

			byLogin := listNames(t, c, metav1.ListOptions{FieldSelector: "spec.login=beta-authz"})
			require.Empty(t, byLogin)

			byEmail := listNames(t, c, metav1.ListOptions{FieldSelector: "spec.email=beta-authz@example.com"})
			require.Empty(t, byEmail)

			byInternalID := listNames(t, c, metav1.ListOptions{
				LabelSelector: fmt.Sprintf("%s=%d", utils.LabelKeyDeprecatedInternalID, betaID),
			})
			require.Empty(t, byInternalID)

			// The same selectors still resolve for the user the caller may read.
			byAllowedLogin := listNames(t, c, metav1.ListOptions{FieldSelector: "spec.login=alpha-authz"})
			require.Equal(t, []string{alphaName}, byAllowedLogin)
		})

		t.Run("admin of another org cannot reach this org's users", func(t *testing.T) {
			otherAdmin := helper.OrgB.Admin
			otherNS := otherAdmin.Identity.Namespace

			// Addressing the Org1 namespace.
			c := clientFor(otherAdmin, orgNS)
			_, err := c.List(ctx, metav1.ListOptions{})
			require.True(t, errors.IsForbidden(err), "unexpected error: %v", err)
			_, err = c.Get(ctx, alphaName, metav1.GetOptions{})
			require.True(t, errors.IsForbidden(err), "unexpected error: %v", err)
			status, _ := searchLogins(t, otherAdmin, orgNS)
			require.Equal(t, 403, status)

			// Addressing its own namespace must not leak the Org1 users.
			own := clientFor(otherAdmin, otherNS)
			names := listNames(t, own, metav1.ListOptions{})
			require.NotContains(t, names, alphaName)
			require.NotContains(t, names, betaName)
			_, err = own.Get(ctx, alphaName, metav1.GetOptions{})
			require.Error(t, err)
			status, logins := searchLogins(t, otherAdmin, otherNS)
			require.Equal(t, 200, status)
			require.NotContains(t, logins, "alpha-authz")
			require.NotContains(t, logins, "beta-authz")
		})
	})
}
