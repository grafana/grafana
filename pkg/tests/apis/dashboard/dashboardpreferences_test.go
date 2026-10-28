package dashboards

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const dashboardPreferencesTierLabel = "dashboard.grafana.app/preferences-tier"

func TestIntegrationDashboardPreferencesV2Beta1(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:        true,
		DisableAuthZClientCache: true,
		EnableFeatureToggles:    []string{featuremgmt.FlagGrafanaDashboardPreferences},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	admin := dashboardPreferencesClient(helper, helper.Org1.Admin)
	editor := dashboardPreferencesClient(helper, helper.Org1.Editor)
	viewer := dashboardPreferencesClient(helper, helper.Org1.Viewer)

	adminUID := helper.Org1.Admin.Identity.GetIdentifier()
	editorUID := helper.Org1.Editor.Identity.GetIdentifier()
	editorTier := "user-" + editorUID
	f1 := createDashboardPreferencesFolder(t, ctx, helper, "F1")

	t.Run("PUT creates the org tier", func(t *testing.T) {
		_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject("namespace", "", preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
		require.NoError(t, err)

		got, err := admin.Resource.Get(ctx, "namespace", metav1.GetOptions{})
		require.NoError(t, err)
		preload, _, err := unstructured.NestedBool(got.Object, "spec", "dashboard", "preload")
		require.NoError(t, err)
		require.True(t, preload)
	})

	t.Run("spec-only merge PATCH creates the user tier", func(t *testing.T) {
		_, err := editor.Resource.Patch(ctx, editorTier, types.MergePatchType, []byte(`{"spec":{"dashboard":{"cursorSync":"Crosshair"}}}`), metav1.PatchOptions{})
		require.NoError(t, err)

		got, err := editor.Resource.Get(ctx, editorTier, metav1.GetOptions{})
		require.NoError(t, err)
		userUID, _, err := unstructured.NestedString(got.Object, "spec", "userUID")
		require.NoError(t, err)
		require.Equal(t, editorUID, userUID)
		cursorSync, _, err := unstructured.NestedString(got.Object, "spec", "dashboard", "cursorSync")
		require.NoError(t, err)
		require.Equal(t, "Crosshair", cursorSync)
		require.Equal(t, "user", got.GetLabels()[dashboardPreferencesTierLabel])
	})

	t.Run("spec-only merge PATCH creates the folder tier", func(t *testing.T) {
		_, err := admin.Resource.Patch(ctx, "folder-"+f1, types.MergePatchType, []byte(`{"spec":{"dashboard":{"preload":true}}}`), metav1.PatchOptions{})
		require.NoError(t, err)

		got, err := admin.Resource.Get(ctx, "folder-"+f1, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, f1, got.GetAnnotations()[utils.AnnoKeyFolder])
		require.Equal(t, "folder", got.GetLabels()[dashboardPreferencesTierLabel])
		require.NotContains(t, got.GetLabels(), utils.AnnoKeyFolder, "the folder tier must not carry a folder label")
	})

	t.Run("null clears a field", func(t *testing.T) {
		_, err := editor.Resource.Patch(ctx, editorTier, types.MergePatchType, []byte(`{"spec":{"dashboard":{"cursorSync":null}}}`), metav1.PatchOptions{})
		require.NoError(t, err)

		got, err := editor.Resource.Get(ctx, editorTier, metav1.GetOptions{})
		require.NoError(t, err)
		_, found, err := unstructured.NestedFieldNoCopy(got.Object, "spec", "dashboard")
		require.NoError(t, err)
		require.False(t, found, "clearing the only dashboard field must remove the section")
	})

	t.Run("DELETE clears a tier", func(t *testing.T) {
		require.NoError(t, editor.Resource.Delete(ctx, editorTier, metav1.DeleteOptions{}))
		_, err := editor.Resource.Get(ctx, editorTier, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)

		require.NoError(t, admin.Resource.Delete(ctx, "namespace", metav1.DeleteOptions{}))
		_, err = admin.Resource.Get(ctx, "namespace", metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
	})

	t.Run("name must match the tier", func(t *testing.T) {
		_, err := admin.Resource.Create(ctx, buildDashboardPreferencesObject("folder-"+f1, "", map[string]any{
			"userUID":   adminUID,
			"dashboard": map[string]any{"preload": true},
		}), metav1.CreateOptions{})
		require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
	})

	t.Run("both scopes rejected", func(t *testing.T) {
		_, err := admin.Resource.Create(ctx, buildDashboardPreferencesObject("", f1, map[string]any{
			"userUID":   adminUID,
			"dashboard": map[string]any{"preload": true},
		}), metav1.CreateOptions{})
		require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
	})

	t.Run("missing folder", func(t *testing.T) {
		_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject("folder-doesnotexist", "doesnotexist", preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
		require.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
		require.ErrorContains(t, err, `folders.folder.grafana.app "doesnotexist" not found`)
	})

	t.Run("invalid spec", func(t *testing.T) {
		_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject("namespace", "", map[string]any{
			"dashboard": map[string]any{"fiscalYearStartMonth": int64(12)},
		}), metav1.UpdateOptions{})
		require.True(t, apierrors.IsInvalid(err), "expected Invalid, got %v", err)
	})

	t.Run("size limit", func(t *testing.T) {
		_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject("namespace", "", map[string]any{
			"dashboard": map[string]any{"autoRefresh": strings.Repeat("x", 33)},
		}), metav1.UpdateOptions{})
		require.True(t, apierrors.IsInvalid(err), "expected Invalid, got %v", err)
	})

	t.Run("empty interval list rejected", func(t *testing.T) {
		_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject("namespace", "", map[string]any{
			"dashboard": map[string]any{"autoRefreshIntervals": []any{}},
		}), metav1.UpdateOptions{})
		require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
	})

	t.Run("panel preferences are rejected for now", func(t *testing.T) {
		_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject("namespace", "", map[string]any{
			"panels": map[string]any{"legend": map[string]any{"placement": "right"}},
		}), metav1.UpdateOptions{})
		require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
		require.ErrorContains(t, err, "panel preferences are not supported yet")
	})

	t.Run("continue is rejected", func(t *testing.T) {
		_, err := viewer.Resource.List(ctx, metav1.ListOptions{Continue: "x"})
		require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got %v", err)
	})

	// The authorizer denies both verbs and the storage serves neither, so either refusal will do.
	t.Run("watch is not served", func(t *testing.T) {
		w, err := viewer.Resource.Watch(ctx, metav1.ListOptions{})
		if err == nil {
			w.Stop()
		}
		require.True(t, apierrors.IsForbidden(err) || apierrors.IsMethodNotSupported(err), "expected Forbidden or MethodNotAllowed, got %v", err)
	})

	t.Run("deletecollection is not served", func(t *testing.T) {
		err := admin.Resource.DeleteCollection(ctx, metav1.DeleteOptions{}, metav1.ListOptions{})
		require.True(t, apierrors.IsForbidden(err) || apierrors.IsMethodNotSupported(err), "expected Forbidden or MethodNotAllowed, got %v", err)
	})
}

func TestIntegrationDashboardPreferencesV2Beta1Authz(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:        true,
		DisableAuthZClientCache: true,
		EnableFeatureToggles:    []string{featuremgmt.FlagGrafanaDashboardPreferences},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	admin := dashboardPreferencesClient(helper, helper.Org1.Admin)
	editor := dashboardPreferencesClient(helper, helper.Org1.Editor)
	viewer := dashboardPreferencesClient(helper, helper.Org1.Viewer)
	none := dashboardPreferencesClient(helper, helper.Org1.None)

	f1 := createDashboardPreferencesFolder(t, ctx, helper, "F1")
	f2 := createDashboardPreferencesFolder(t, ctx, helper, "F2")
	body, err := json.Marshal(map[string]string{"title": "F2c", "parentUid": f2})
	require.NoError(t, err)
	child := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin, Method: http.MethodPost, Path: "/api/folders", Body: body, ContentType: "application/json",
	}, &struct {
		UID string `json:"uid"`
	}{})
	require.Equal(t, http.StatusOK, child.Response.StatusCode)
	f2c := child.Result.UID

	adminID, err := identity.UserIdentifier(helper.Org1.Admin.Identity.GetID())
	require.NoError(t, err)
	editorID, err := identity.UserIdentifier(helper.Org1.Editor.Identity.GetID())
	require.NoError(t, err)
	// Setting permissions replaces the folder's whole ACL, so the admin is listed again.
	setFolderPermissions(t, helper, helper.Org1.Admin, f2, []ResourcePermissionSetting{
		{UserID: &adminID, Level: ResourcePermissionLevelAdmin},
		{UserID: &editorID, Level: ResourcePermissionLevelAdmin},
	})

	t.Run("org tier", func(t *testing.T) {
		_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject("namespace", "", preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
		require.NoError(t, err, "admin PUT")

		_, err = viewer.Resource.Get(ctx, "namespace", metav1.GetOptions{})
		require.NoError(t, err, "viewer GET")

		for _, u := range []struct {
			name   string
			client *apis.K8sResourceClient
		}{{"editor", editor}, {"viewer", viewer}} {
			_, err = u.client.Resource.Update(ctx, buildDashboardPreferencesObject("namespace", "", preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
			require.True(t, apierrors.IsForbidden(err), "%s PUT: expected Forbidden, got %v", u.name, err)

			_, err = u.client.Resource.Patch(ctx, "namespace", types.MergePatchType, []byte(`{"spec":{"dashboard":{"preload":false}}}`), metav1.PatchOptions{})
			require.True(t, apierrors.IsForbidden(err), "%s PATCH: expected Forbidden, got %v", u.name, err)

			err = u.client.Resource.Delete(ctx, "namespace", metav1.DeleteOptions{})
			require.True(t, apierrors.IsForbidden(err), "%s DELETE: expected Forbidden, got %v", u.name, err)
		}

		_, err = editor.Resource.Create(ctx, buildDashboardPreferencesObject("", "", preloadDashboardPreferencesSpec()), metav1.CreateOptions{})
		require.True(t, apierrors.IsForbidden(err), "editor POST: expected Forbidden, got %v", err)
	})

	t.Run("user tier", func(t *testing.T) {
		editorUID := helper.Org1.Editor.Identity.GetIdentifier()
		editorTier := "user-" + editorUID

		_, err := editor.Resource.Update(ctx, buildDashboardPreferencesObject(editorTier, "", map[string]any{
			"userUID":   editorUID,
			"dashboard": map[string]any{"preload": true},
		}), metav1.UpdateOptions{})
		require.NoError(t, err, "owner PUT")

		_, err = editor.Resource.Patch(ctx, editorTier, types.MergePatchType, []byte(`{"spec":{"dashboard":{"hideTimepicker":true}}}`), metav1.PatchOptions{})
		require.NoError(t, err, "owner PATCH")

		list, err := editor.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Contains(t, dashboardPreferencesNames(list), editorTier, "the owner's list must contain its user tier")

		_, err = viewer.Resource.Get(ctx, editorTier, metav1.GetOptions{})
		require.True(t, apierrors.IsForbidden(err), "viewer GET: expected Forbidden, got %v", err)

		_, err = viewer.Resource.Patch(ctx, editorTier, types.MergePatchType, []byte(`{"spec":{"dashboard":{"preload":false}}}`), metav1.PatchOptions{})
		require.True(t, apierrors.IsForbidden(err), "viewer PATCH: expected Forbidden, got %v", err)

		_, err = admin.Resource.Get(ctx, editorTier, metav1.GetOptions{})
		require.True(t, apierrors.IsForbidden(err), "admin GET: expected Forbidden, got %v", err)

		list, err = viewer.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotContains(t, dashboardPreferencesNames(list), editorTier)

		_, err = viewer.Resource.List(ctx, metav1.ListOptions{FieldSelector: "metadata.name=" + editorTier})
		require.True(t, apierrors.IsForbidden(err), "viewer List by name: expected Forbidden, got %v", err)
	})

	t.Run("folder tier", func(t *testing.T) {
		f1Tier := "folder-" + f1
		f2Tier := "folder-" + f2

		_, err := admin.Resource.Update(ctx, buildDashboardPreferencesObject(f1Tier, f1, preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
		require.NoError(t, err, "admin PUT")

		// A new folder gives Editors Edit, which reads the folder but doesn't administer it.
		_, err = editor.Resource.Get(ctx, f1Tier, metav1.GetOptions{})
		require.NoError(t, err, "folder editor GET")
		_, err = editor.Resource.Update(ctx, buildDashboardPreferencesObject(f1Tier, f1, preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
		require.True(t, apierrors.IsForbidden(err), "folder editor PUT: expected Forbidden, got %v", err)

		_, err = viewer.Resource.Get(ctx, f1Tier, metav1.GetOptions{})
		require.NoError(t, err, "folder viewer GET")
		list, err := viewer.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Contains(t, dashboardPreferencesNames(list), f1Tier, "a folder viewer's list must contain the folder tier")

		_, err = none.Resource.Get(ctx, f1Tier, metav1.GetOptions{})
		require.True(t, apierrors.IsForbidden(err), "GET without folder access: expected Forbidden, got %v", err)
		list, err = none.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotContains(t, dashboardPreferencesNames(list), f1Tier)

		_, err = editor.Resource.Update(ctx, buildDashboardPreferencesObject(f2Tier, f2, preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
		require.NoError(t, err, "folder admin PUT")
		_, err = editor.Resource.Update(ctx, buildDashboardPreferencesObject("folder-"+f2c, f2c, preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
		require.NoError(t, err, "PUT on a subfolder of an administered folder")

		// F2's replaced ACL leaves out the Viewer role, so the viewer can read F1 but not F2.
		_, err = viewer.Resource.Get(ctx, f2Tier, metav1.GetOptions{})
		require.True(t, apierrors.IsForbidden(err), "viewer GET on a folder it can't read: expected Forbidden, got %v", err)
		list, err = viewer.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Contains(t, dashboardPreferencesNames(list), f1Tier)
		require.NotContains(t, dashboardPreferencesNames(list), f2Tier, "the list must filter each folder, not the caller's role")
	})

	t.Run("cross-org", func(t *testing.T) {
		orgBAdmin := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.OrgB.Admin,
			Namespace: helper.Namespacer(helper.Org1.OrgID),
			GVR:       dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource(),
		})

		_, err := orgBAdmin.Resource.Get(ctx, "namespace", metav1.GetOptions{})
		require.True(t, apierrors.IsForbidden(err), "GET: expected Forbidden, got %v", err)

		_, err = orgBAdmin.Resource.List(ctx, metav1.ListOptions{})
		require.True(t, apierrors.IsForbidden(err), "List: expected Forbidden, got %v", err)

		_, err = orgBAdmin.Resource.Update(ctx, buildDashboardPreferencesObject("namespace", "", preloadDashboardPreferencesSpec()), metav1.UpdateOptions{})
		require.True(t, apierrors.IsForbidden(err), "PUT: expected Forbidden, got %v", err)
	})
}

// Storage is always registered, so with the flag off the authorizer is what turns requests away: 403, not 404.
func TestIntegrationDashboardPreferencesV2Beta1FlagDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	admin := dashboardPreferencesClient(helper, helper.Org1.Admin)

	const denyReason = "dashboard preferences feature is not enabled"

	_, err := admin.Resource.List(ctx, metav1.ListOptions{})
	require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
	require.ErrorContains(t, err, denyReason)

	_, err = admin.Resource.Create(ctx, buildDashboardPreferencesObject("", "", preloadDashboardPreferencesSpec()), metav1.CreateOptions{})
	require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
	require.ErrorContains(t, err, denyReason)
}

func dashboardPreferencesClient(helper *apis.K8sTestHelper, user apis.User) *apis.K8sResourceClient {
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User: user,
		GVR:  dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource(),
	})
}

// createDashboardPreferencesFolder creates a folder as the org admin and returns its UID.
func createDashboardPreferencesFolder(t *testing.T, ctx context.Context, helper *apis.K8sTestHelper, title string) string {
	t.Helper()
	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  foldersV1.FolderResourceInfo.GroupVersionResource(),
	})
	created, err := folderClient.Resource.Create(ctx, buildFolderObject(helper.Namespacer(helper.Org1.OrgID), title), metav1.CreateOptions{})
	require.NoError(t, err)
	return created.GetName()
}

func buildDashboardPreferencesObject(name string, folderUID string, spec map[string]any) *unstructured.Unstructured {
	metadata := map[string]any{}
	if name != "" {
		metadata["name"] = name
	}
	if folderUID != "" {
		metadata["annotations"] = map[string]any{utils.AnnoKeyFolder: folderUID}
	}

	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": dashv2beta1.DashboardPreferencesResourceInfo.GroupVersion().String(),
			"kind":       dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind().Kind,
			"metadata":   metadata,
			"spec":       spec,
		},
	}
}

func preloadDashboardPreferencesSpec() map[string]any {
	return map[string]any{"dashboard": map[string]any{"preload": true}}
}

func dashboardPreferencesNames(list *unstructured.UnstructuredList) []string {
	out := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		out = append(out, item.GetName())
	}
	return out
}
