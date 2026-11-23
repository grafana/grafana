package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardpreferences"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDashboardPreferencesUserCleanup(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	t.Cleanup(helper.Shutdown)

	orgB := helper.CreateOrg(apis.Org2)
	viewerUID := helper.Org1.Viewer.Identity.GetIdentifier()
	seedDashboardPreferencesUserTier(t, helper, 1, viewerUID)
	seedDashboardPreferencesUserTier(t, helper, orgB, viewerUID)

	t.Run("removing a user from an org deletes their preferences in that org only", func(t *testing.T) {
		u, id, uid := createDashboardPreferencesCleanupViewer(t, helper, "prefs-cleanup-org-removal")
		helper.AddUserToOrg(u, apis.Org2, authlib.RoleViewer)
		seedDashboardPreferencesUserTier(t, helper, 1, uid)
		seedDashboardPreferencesUserTier(t, helper, orgB, uid)

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   fmt.Sprintf("/api/orgs/%d/users/%d", orgB, id),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "body: %s", string(rsp.Body))

		requireDashboardPreferencesUserTier(t, helper, orgB, uid, false)
		requireDashboardPreferencesUserTier(t, helper, 1, uid, true)
		requireDashboardPreferencesUserTier(t, helper, orgB, viewerUID, true)
	})

	t.Run("deleting a user deletes their preferences in every org", func(t *testing.T) {
		u, id, uid := createDashboardPreferencesCleanupViewer(t, helper, "prefs-cleanup-user-delete")
		helper.AddUserToOrg(u, apis.Org2, authlib.RoleViewer)
		seedDashboardPreferencesUserTier(t, helper, 1, uid)
		seedDashboardPreferencesUserTier(t, helper, orgB, uid)

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   fmt.Sprintf("/api/admin/users/%d", id),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "body: %s", string(rsp.Body))

		requireDashboardPreferencesUserTier(t, helper, 1, uid, false)
		requireDashboardPreferencesUserTier(t, helper, orgB, uid, false)
		requireDashboardPreferencesUserTier(t, helper, 1, viewerUID, true)
		requireDashboardPreferencesUserTier(t, helper, orgB, viewerUID, true)
	})

	t.Run("removing a user from their only org deletes their preferences", func(t *testing.T) {
		_, id, uid := createDashboardPreferencesCleanupViewer(t, helper, "prefs-cleanup-orphan")
		seedDashboardPreferencesUserTier(t, helper, 1, uid)

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   fmt.Sprintf("/api/org/users/%d", id),
		}, &struct {
			Message string `json:"message"`
		}{})
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "body: %s", string(rsp.Body))
		require.Equal(t, "User deleted", rsp.Result.Message)

		requireDashboardPreferencesUserTier(t, helper, 1, uid, false)
	})
}

func TestIntegrationDashboardPreferencesUserCleanupKubernetesUsers(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode5} {
		t.Run(fmt.Sprintf("dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous:       true,
				APIServerStorageType:   "unified",
				RBACSingleOrganization: true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesUsersApi,
					featuremgmt.FlagKubernetesUsersRedirect,
					featuremgmt.FlagGrafanaDashboardPreferences,
				},
			})
			t.Cleanup(helper.Shutdown)

			ctx := context.Background()
			users := helper.GetResourceClient(apis.ResourceClientArgs{
				User:      helper.Org1.Admin,
				Namespace: helper.Namespacer(1),
				GVR:       iamv0.UserResourceInfo.GroupVersionResource(),
			})

			t.Run("a dry-run User delete keeps the user's preferences", func(t *testing.T) {
				_, uid := createDashboardPreferencesCleanupUser(t, helper, "prefs-cleanup-dry-run")
				seedDashboardPreferencesUserTier(t, helper, 1, uid)

				err := users.Resource.Delete(ctx, uid, metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}})
				require.NoError(t, err)

				requireDashboardPreferencesUserTier(t, helper, 1, uid, true)
			})

			t.Run("deleting the User object deletes the user's preferences", func(t *testing.T) {
				_, uid := createDashboardPreferencesCleanupUser(t, helper, "prefs-cleanup-user-api")
				seedDashboardPreferencesUserTier(t, helper, 1, uid)

				err := users.Resource.Delete(ctx, uid, metav1.DeleteOptions{})
				require.NoError(t, err)

				requireDashboardPreferencesUserTier(t, helper, 1, uid, false)
			})

			t.Run("deleting a user through the admin API deletes their preferences", func(t *testing.T) {
				id, uid := createDashboardPreferencesCleanupUser(t, helper, "prefs-cleanup-admin-api")
				seedDashboardPreferencesUserTier(t, helper, 1, uid)

				rsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: http.MethodDelete,
					Path:   fmt.Sprintf("/api/admin/users/%d", id),
				}, &struct{}{})
				require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "body: %s", string(rsp.Body))

				requireDashboardPreferencesUserTier(t, helper, 1, uid, false)
			})

			t.Run("other users' preferences are kept", func(t *testing.T) {
				_, uid := createDashboardPreferencesCleanupUser(t, helper, "prefs-cleanup-deleted")
				_, otherUID := createDashboardPreferencesCleanupUser(t, helper, "prefs-cleanup-kept")
				seedDashboardPreferencesUserTier(t, helper, 1, uid)
				seedDashboardPreferencesUserTier(t, helper, 1, otherUID)

				err := users.Resource.Delete(ctx, uid, metav1.DeleteOptions{})
				require.NoError(t, err)

				requireDashboardPreferencesUserTier(t, helper, 1, uid, false)
				requireDashboardPreferencesUserTier(t, helper, 1, otherUID, true)
			})

			t.Run("a missing tier is an object-level NotFound", func(t *testing.T) {
				name := dashv2beta1.DashboardPreferencesUserName(helper.Org1.Editor.Identity.GetIdentifier())

				err := dashboardPreferencesClient(helper, helper.Org1.Editor).Resource.Delete(ctx, name, metav1.DeleteOptions{})
				require.True(t, dashboardpreferences.IsNotFound(err, name), "expected the cleaner to read this as a missing object, got %v", err)
			})
		})
	}
}

// createDashboardPreferencesCleanupViewer creates a Viewer in org 1 and returns the user, its ID and its UID.
func createDashboardPreferencesCleanupViewer(t *testing.T, helper *apis.K8sTestHelper, name string) (apis.User, int64, string) {
	t.Helper()
	u := helper.CreateUser(name, apis.Org1, authlib.RoleViewer, nil)
	id, err := identity.UserIdentifier(u.Identity.GetID())
	require.NoError(t, err)
	uid := u.Identity.GetIdentifier()
	require.NotEmpty(t, uid)
	return u, id, uid
}

// createDashboardPreferencesCleanupUser creates a user through the admin API and returns its ID and UID.
func createDashboardPreferencesCleanupUser(t *testing.T, helper *apis.K8sTestHelper, login string) (int64, string) {
	t.Helper()
	body, err := json.Marshal(map[string]string{
		"name":     login,
		"email":    login + "@example.com",
		"login":    login,
		"password": "password123",
	})
	require.NoError(t, err)

	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodPost,
		Path:   "/api/admin/users",
		Body:   body,
	}, &struct {
		ID  int64  `json:"id"`
		UID string `json:"uid"`
	}{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "body: %s", string(rsp.Body))
	require.NotZero(t, rsp.Result.ID)
	require.NotEmpty(t, rsp.Result.UID)
	return rsp.Result.ID, rsp.Result.UID
}

// seedDashboardPreferencesUserTier writes user-<userUID> straight into unified storage, so that it
// also works while the API refuses writes because grafana.dashboardPreferences is off.
func seedDashboardPreferencesUserTier(t *testing.T, helper *apis.K8sTestHelper, orgID int64, userUID string) {
	t.Helper()
	ctx, _ := identity.WithServiceIdentity(context.Background(), orgID)
	key := dashboardPreferencesUserTierKey(helper, orgID, userUID)
	value, err := json.Marshal(map[string]any{
		"apiVersion": dashv2beta1.DashboardPreferencesResourceInfo.GroupVersion().String(),
		"kind":       dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind().Kind,
		"metadata": map[string]any{
			"name":      key.Name,
			"namespace": key.Namespace,
		},
		"spec": preloadDashboardPreferencesSpec(),
	})
	require.NoError(t, err)
	_, err = helper.GetEnv().ResourceClient.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: value})
	require.NoError(t, err)
}

// requireDashboardPreferencesUserTier checks whether user-<userUID> is in unified storage.
func requireDashboardPreferencesUserTier(t *testing.T, helper *apis.K8sTestHelper, orgID int64, userUID string, wantPresent bool) {
	t.Helper()
	serviceCtx, _ := identity.WithServiceIdentity(context.Background(), orgID)
	rsp, err := helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: dashboardPreferencesUserTierKey(helper, orgID, userUID)})
	if wantPresent {
		require.NoError(t, err)
		require.NotEmpty(t, rsp.GetValue())
		return
	}
	require.Error(t, err)
	res := resource.AsErrorResult(err)
	require.NotNil(t, res)
	require.Equal(t, int32(http.StatusNotFound), res.Code)
}

func dashboardPreferencesUserTierKey(helper *apis.K8sTestHelper, orgID int64, userUID string) *resourcepb.ResourceKey {
	gr := dashv2beta1.DashboardPreferencesResourceInfo.GroupResource()
	return &resourcepb.ResourceKey{
		Namespace: helper.Namespacer(orgID),
		Group:     gr.Group,
		Resource:  gr.Resource,
		Name:      dashv2beta1.DashboardPreferencesUserName(userUID),
	}
}
