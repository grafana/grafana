package dashboards

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDashboardPreferencesFolderDelete(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:        true,
		DisableAuthZClientCache: true,
		EnableFeatureToggles:    []string{featuremgmt.FlagGrafanaDashboardPreferences, featuremgmt.FlagKubernetesFolderCascadeDelete},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	admin := dashboardPreferencesClient(helper, helper.Org1.Admin)
	adminFolders := dashboardPreferencesFolderClient(helper, helper.Org1.Admin)

	t.Run("a k8s delete of an empty folder deletes its folder tier", func(t *testing.T) {
		uid := createDashboardPreferencesFolder(t, ctx, helper, "pfd plain")
		putFolderDashboardPreferences(t, ctx, admin, uid)

		require.NoError(t, adminFolders.Resource.Delete(ctx, uid, metav1.DeleteOptions{}))

		require.False(t, dashboardPreferencesStored(t, ctx, helper, "folder-"+uid))
	})

	t.Run("a folder editor who is not a folder admin deletes the folder and its tier", func(t *testing.T) {
		createLegacyFolder(t, helper, helper.Org1.Admin, map[string]any{"uid": "pfd-e", "title": "pfd-e"})
		putFolderDashboardPreferences(t, ctx, admin, "pfd-e")

		require.NoError(t, dashboardPreferencesFolderClient(helper, helper.Org1.Editor).Resource.Delete(ctx, "pfd-e", metav1.DeleteOptions{}))

		require.False(t, dashboardPreferencesStored(t, ctx, helper, "folder-pfd-e"))
	})
}

func TestIntegrationDashboardPreferencesFolderDeleteSubtree(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:        true,
		DisableAuthZClientCache: true,
		EnableFeatureToggles:    []string{featuremgmt.FlagGrafanaDashboardPreferences, featuremgmt.FlagKubernetesFolderCascadeDelete},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	admin := dashboardPreferencesClient(helper, helper.Org1.Admin)
	adminFolders := dashboardPreferencesFolderClient(helper, helper.Org1.Admin)
	zero := int64(0)

	// createSubtree creates prefix-parent, prefix-child and prefix-grandchild nested in that order,
	// plus the root folder prefix-keep, each with its folder tier, and returns the subtree's UIDs.
	createSubtree := func(t *testing.T, prefix string) []string {
		t.Helper()
		parent, child, grandchild, keep := prefix+"-parent", prefix+"-child", prefix+"-grandchild", prefix+"-keep"
		createLegacyFolder(t, helper, helper.Org1.Admin, map[string]any{"uid": parent, "title": parent})
		createLegacyFolder(t, helper, helper.Org1.Admin, map[string]any{"uid": child, "title": child, "parentUid": parent})
		createLegacyFolder(t, helper, helper.Org1.Admin, map[string]any{"uid": grandchild, "title": grandchild, "parentUid": child})
		createLegacyFolder(t, helper, helper.Org1.Admin, map[string]any{"uid": keep, "title": keep})
		for _, uid := range []string{parent, child, grandchild, keep} {
			putFolderDashboardPreferences(t, ctx, admin, uid)
		}
		return []string{parent, child, grandchild}
	}

	t.Run("a legacy delete deletes the folder tier of every folder in the subtree", func(t *testing.T) {
		subtree := createSubtree(t, "pfd-l")

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   "/api/folders/pfd-l-parent",
		}, &map[string]any{})
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "DELETE /api/folders/pfd-l-parent: %s", rsp.Body)

		for _, uid := range subtree {
			require.False(t, dashboardPreferencesStored(t, ctx, helper, "folder-"+uid), "folder-%s", uid)
		}
		require.True(t, dashboardPreferencesStored(t, ctx, helper, "folder-pfd-l-keep"))
	})

	t.Run("a forced cascade delete deletes the folder tier of every folder in the subtree", func(t *testing.T) {
		subtree := createSubtree(t, "pfd-c")

		require.NoError(t, adminFolders.Resource.Delete(ctx, "pfd-c-parent", metav1.DeleteOptions{GracePeriodSeconds: &zero}))

		for _, uid := range subtree {
			require.False(t, dashboardPreferencesStored(t, ctx, helper, "folder-"+uid), "folder-%s", uid)
		}
		require.True(t, dashboardPreferencesStored(t, ctx, helper, "folder-pfd-c-keep"))
	})
}

func TestIntegrationDashboardPreferencesFolderDeleteFinalizer(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{featuremgmt.FlagGrafanaDashboardPreferences, featuremgmt.FlagFolderAsyncCascadeDeleteThroughController},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	admin := dashboardPreferencesClient(helper, helper.Org1.Admin)
	adminFolders := dashboardPreferencesFolderClient(helper, helper.Org1.Admin)
	dropFinalizers := []byte(`{"metadata":{"finalizers":null}}`)

	t.Run("a terminating folder keeps its tier and the release deletes it", func(t *testing.T) {
		uid := createDashboardPreferencesFolder(t, ctx, helper, "pfd finalizer")
		putFolderDashboardPreferences(t, ctx, admin, uid)

		require.NoError(t, adminFolders.Resource.Delete(ctx, uid, metav1.DeleteOptions{}))
		terminating, err := adminFolders.Resource.Get(ctx, uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, terminating.GetDeletionTimestamp())
		require.True(t, dashboardPreferencesStored(t, ctx, helper, "folder-"+uid))

		_, err = adminFolders.Resource.Patch(ctx, uid, types.MergePatchType, dropFinalizers, metav1.PatchOptions{})
		require.NoError(t, err)

		_, err = adminFolders.Resource.Get(ctx, uid, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
		require.False(t, dashboardPreferencesStored(t, ctx, helper, "folder-"+uid))
	})
}

func TestIntegrationDashboardPreferencesFolderDeleteFlagDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()

	t.Run("a legacy delete deletes a leftover tier", func(t *testing.T) {
		createLegacyFolder(t, helper, helper.Org1.Admin, map[string]any{"uid": "pfd-off-l", "title": "pfd-off-l"})
		storeDashboardPreferences(t, ctx, helper, "folder-pfd-off-l")

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   "/api/folders/pfd-off-l",
		}, &map[string]any{})
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "DELETE /api/folders/pfd-off-l: %s", rsp.Body)

		require.False(t, dashboardPreferencesStored(t, ctx, helper, "folder-pfd-off-l"))
	})

	t.Run("a k8s delete deletes a leftover tier", func(t *testing.T) {
		uid := createDashboardPreferencesFolder(t, ctx, helper, "pfd off k8s")
		storeDashboardPreferences(t, ctx, helper, "folder-"+uid)

		require.NoError(t, dashboardPreferencesFolderClient(helper, helper.Org1.Admin).Resource.Delete(ctx, uid, metav1.DeleteOptions{}))

		require.False(t, dashboardPreferencesStored(t, ctx, helper, "folder-"+uid))
	})
}

func dashboardPreferencesFolderClient(helper *apis.K8sTestHelper, user apis.User) *apis.K8sResourceClient {
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User: user,
		GVR:  foldersV1.FolderResourceInfo.GroupVersionResource(),
	})
}

func putFolderDashboardPreferences(t *testing.T, ctx context.Context, admin *apis.K8sResourceClient, folderUID string) {
	t.Helper()
	_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject(t, "folder-"+folderUID, preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
	require.NoError(t, err)
}

func dashboardPreferencesKey(helper *apis.K8sTestHelper, name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: helper.Namespacer(helper.Org1.OrgID),
		Group:     "dashboard.grafana.app",
		Resource:  "dashboardpreferences",
		Name:      name,
	}
}

// storeDashboardPreferences writes a tier straight to storage as the service identity, the only way to have one while the flag is off.
func storeDashboardPreferences(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper, name string) {
	t.Helper()
	serviceCtx, _ := identity.WithServiceIdentity(ctx, helper.Org1.OrgID)
	obj := buildDashboardPreferencesObject(t, name, preloadDashboardPreferencesSpec())
	obj.SetNamespace(helper.Namespacer(helper.Org1.OrgID))
	value, err := json.Marshal(obj.Object)
	require.NoError(t, err)
	_, err = helper.GetEnv().ResourceClient.Create(serviceCtx, &resourcepb.CreateRequest{
		Key:   dashboardPreferencesKey(helper, name),
		Value: value,
	})
	require.NoError(t, err)
}

// dashboardPreferencesStored reads storage as the service identity, so the folder the tier names need not exist.
func dashboardPreferencesStored(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper, name string) bool {
	t.Helper()
	serviceCtx, _ := identity.WithServiceIdentity(ctx, helper.Org1.OrgID)
	_, err := helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: dashboardPreferencesKey(helper, name)})
	if err == nil {
		return true
	}
	if resource.AsErrorResult(err).Code == http.StatusNotFound {
		return false
	}
	require.NoError(t, err)
	return false
}
