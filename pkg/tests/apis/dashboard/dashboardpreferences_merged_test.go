package dashboards

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDashboardPreferencesMerged(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// Anonymous access stays on, so the anonymous case needs no server of its own.
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAuthZClientCache: true,
		AnonymousUserRole:       org.RoleViewer,
		EnableFeatureToggles:    []string{featuremgmt.FlagGrafanaDashboardPreferences},
	})
	t.Cleanup(helper.Shutdown)

	const (
		tierOrg    = dashv2beta1.DashboardPreferencesMergedTierOrg
		tierFolder = dashv2beta1.DashboardPreferencesMergedTierFolder
		tierUser   = dashv2beta1.DashboardPreferencesMergedTierUser
	)
	type source = dashv2beta1.DashboardPreferencesMergedSource

	ctx := context.Background()
	admin := dashboardPreferencesClient(helper, helper.Org1.Admin)
	editor := dashboardPreferencesClient(helper, helper.Org1.Editor)
	editorTier := "user-" + helper.Org1.Editor.Identity.GetIdentifier()

	g := createDashboardPreferencesFolder(t, ctx, helper, "G")
	p := createDashboardPreferencesChildFolder(t, helper, "P", g)
	c := createDashboardPreferencesChildFolder(t, helper, "C", p)
	gTier, pTier, cTier := "folder-"+g, "folder-"+p, "folder-"+c

	adminID, err := identity.UserIdentifier(helper.Org1.Admin.Identity.GetID())
	require.NoError(t, err)
	editorID, err := identity.UserIdentifier(helper.Org1.Editor.Identity.GetID())
	require.NoError(t, err)
	// A new root folder grants the Editor and Viewer roles and its subfolders inherit them, so G is narrowed to
	// the admin and the editor is let into P, and so C, by name.
	setFolderPermissions(t, helper, helper.Org1.Admin, g, []ResourcePermissionSetting{
		{UserID: &adminID, Level: ResourcePermissionLevelAdmin},
	})
	setFolderPermissions(t, helper, helper.Org1.Admin, p, []ResourcePermissionSetting{
		{UserID: &adminID, Level: ResourcePermissionLevelAdmin},
		{UserID: &editorID, Level: ResourcePermissionLevelView},
	})

	// The cases for a parent the caller can't read prove nothing unless the editor really can't read G.
	editorFolders := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Editor,
		GVR:  foldersV1.FolderResourceInfo.GroupVersionResource(),
	})
	_, err = editorFolders.Resource.Get(ctx, g, metav1.GetOptions{})
	require.True(t, apierrors.IsForbidden(err), "editor GET G: expected Forbidden, got %v", err)
	for _, uid := range []string{p, c} {
		_, err = editorFolders.Resource.Get(ctx, uid, metav1.GetOptions{})
		require.NoError(t, err, "editor GET %s", uid)
	}
	viewerFolders := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Viewer,
		GVR:  foldersV1.FolderResourceInfo.GroupVersionResource(),
	})
	_, err = viewerFolders.Resource.Get(ctx, c, metav1.GetOptions{})
	require.True(t, apierrors.IsForbidden(err), "viewer GET C: expected Forbidden, got %v", err)

	for _, tier := range []struct {
		name string
		spec map[string]any
	}{
		{"namespace", map[string]any{"dashboard": map[string]any{
			"preload": false, "autoRefresh": "1m", "nowDelay": "1m", "timeRange": map[string]any{"from": "now-6h", "to": "now"},
		}}},
		{gTier, map[string]any{"dashboard": map[string]any{"preload": true, "hideTimepicker": true, "cursorSync": "Tooltip"}}},
		{pTier, map[string]any{"dashboard": map[string]any{"preload": false, "cursorSync": "Crosshair"}}},
		{cTier, map[string]any{
			"dashboard": map[string]any{"preload": true, "autoGrid": map[string]any{"columnWidth": int64(300)}},
			"reset":     []any{"dashboard.timeRange"},
		}},
	} {
		_, err = admin.Resource.Update(ctx, buildDashboardPreferencesObject(t, tier.name, tier.spec), metav1.UpdateOptions{})
		require.NoError(t, err, "admin PUT %s", tier.name)
	}
	_, err = editor.Resource.Update(ctx, buildDashboardPreferencesObject(t, editorTier, map[string]any{
		"dashboard": map[string]any{"preload": false},
		"reset":     []any{"dashboard.layout"},
	}), metav1.UpdateOptions{})
	require.NoError(t, err, "editor PUT %s", editorTier)

	inC := url.Values{"folder": {c}}

	t.Run("each field comes from its highest tier", func(t *testing.T) {
		rsp := getMergedDashboardPreferences(t, helper, helper.Org1.Editor, inC)
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))
		require.JSONEq(t, `{"dashboard":{"preload":false,"autoRefresh":"1m","nowDelay":"1m","hideTimepicker":true,"cursorSync":"Crosshair","autoGrid":{"columnWidth":300}}}`,
			mergedDashboardPreferencesSpecJSON(t, rsp))
		require.Equal(t, map[string]source{
			"dashboard.preload":              {Tier: tierUser, Name: editorTier},
			"dashboard.layout":               {Tier: tierUser, Name: editorTier, Reset: true},
			"dashboard.autoGrid.columnWidth": {Tier: tierFolder, Name: cTier},
			// The org's timeRange doesn't apply.
			"dashboard.timeRange": {Tier: tierFolder, Name: cTier, Reset: true},
			// P is nearer than G.
			"dashboard.cursorSync": {Tier: tierFolder, Name: pTier},
			// G applies, but the editor can't read it.
			"dashboard.hideTimepicker": {Tier: tierFolder},
			"dashboard.autoRefresh":    {Tier: tierOrg, Name: "namespace"},
			"dashboard.nowDelay":       {Tier: tierOrg, Name: "namespace"},
		}, rsp.Result.Sources)
	})

	t.Run("everyone creating in a folder starts from the same values", func(t *testing.T) {
		query := url.Values{"folder": {c}, "includeUser": {"false"}}
		asEditor := getMergedDashboardPreferences(t, helper, helper.Org1.Editor, query)
		require.Equal(t, http.StatusOK, asEditor.Response.StatusCode, string(asEditor.Body))
		asAdmin := getMergedDashboardPreferences(t, helper, helper.Org1.Admin, query)
		require.Equal(t, http.StatusOK, asAdmin.Response.StatusCode, string(asAdmin.Body))

		require.JSONEq(t, mergedDashboardPreferencesSpecJSON(t, asAdmin), mergedDashboardPreferencesSpecJSON(t, asEditor))
		editorSources, adminSources := asEditor.Result.Sources, asAdmin.Result.Sources
		require.Equal(t, source{Tier: tierFolder, Name: cTier}, editorSources["dashboard.preload"])
		require.NotContains(t, editorSources, "dashboard.layout")
		require.Equal(t, source{Tier: tierFolder}, editorSources["dashboard.hideTimepicker"])
		require.Equal(t, source{Tier: tierFolder, Name: gTier}, adminSources["dashboard.hideTimepicker"])
		delete(editorSources, "dashboard.hideTimepicker")
		delete(adminSources, "dashboard.hideTimepicker")
		require.Equal(t, adminSources, editorSources)
	})

	t.Run("without a folder", func(t *testing.T) {
		top := getMergedDashboardPreferences(t, helper, helper.Org1.Editor, nil)
		require.Equal(t, http.StatusOK, top.Response.StatusCode, string(top.Body))
		general := getMergedDashboardPreferences(t, helper, helper.Org1.Editor, url.Values{"folder": {"general"}})
		require.Equal(t, http.StatusOK, general.Response.StatusCode, string(general.Body))

		require.Equal(t, top.Result, general.Result)
		require.JSONEq(t, `{"dashboard":{"preload":false,"autoRefresh":"1m","nowDelay":"1m","timeRange":{"from":"now-6h","to":"now"}}}`,
			mergedDashboardPreferencesSpecJSON(t, top))
		require.Equal(t, map[string]source{
			"dashboard.preload":     {Tier: tierUser, Name: editorTier},
			"dashboard.layout":      {Tier: tierUser, Name: editorTier, Reset: true},
			"dashboard.autoRefresh": {Tier: tierOrg, Name: "namespace"},
			"dashboard.nowDelay":    {Tier: tierOrg, Name: "namespace"},
			"dashboard.timeRange":   {Tier: tierOrg, Name: "namespace"},
		}, top.Result.Sources)
	})

	t.Run("bad requests", func(t *testing.T) {
		for _, query := range []url.Values{
			{"folder": {"sharedwithme"}},
			{"folder": {"has space"}},
			{"folder": {".."}},
			{"includeUser": {"maybe"}},
		} {
			rsp := getMergedDashboardPreferences(t, helper, helper.Org1.Editor, query)
			require.Equal(t, http.StatusBadRequest, rsp.Response.StatusCode, "%s: %s", query.Encode(), rsp.Body)
		}
	})

	t.Run("unknown and forbidden folders", func(t *testing.T) {
		const unknownUID = "doesnotexist"

		// A 404 needs the folder API's NotFound to name the folder.
		rsp := getMergedDashboardPreferences(t, helper, helper.Org1.Admin, url.Values{"folder": {unknownUID}})
		require.Equal(t, http.StatusNotFound, rsp.Response.StatusCode, string(rsp.Body))
		require.True(t, apierrors.IsNotFound(&apierrors.StatusError{ErrStatus: *rsp.Status}), "expected NotFound, got %+v", rsp.Status)

		for _, tc := range []struct {
			name   string
			user   apis.User
			folder string
		}{
			// A caller who can't read the UID doesn't learn whether the folder exists.
			{"editor, unknown folder", helper.Org1.Editor, unknownUID},
			{"viewer, C", helper.Org1.Viewer, c},
			{"editor, G", helper.Org1.Editor, g},
		} {
			rsp := getMergedDashboardPreferences(t, helper, tc.user, url.Values{"folder": {tc.folder}})
			require.Equal(t, http.StatusForbidden, rsp.Response.StatusCode, "%s: %s", tc.name, rsp.Body)
		}
	})

	t.Run("identities the authorizer turns away", func(t *testing.T) {
		anonymous := getMergedDashboardPreferences(t, helper, apis.User{}, nil)
		require.Equal(t, http.StatusForbidden, anonymous.Response.StatusCode, string(anonymous.Body))
		require.Contains(t, anonymous.Status.Message, "dashboard preferences are not available to anonymous or render identities")

		otherOrg := getMergedDashboardPreferences(t, helper, helper.OrgB.Admin, nil)
		require.Equal(t, http.StatusForbidden, otherOrg.Response.StatusCode, string(otherOrg.Body))
	})

	t.Run("each tier gives way to the next", func(t *testing.T) {
		for _, step := range []struct {
			deleted string
			client  *apis.K8sResourceClient
			source  *source
			preload *bool
		}{
			{source: &source{Tier: tierUser, Name: editorTier}, preload: ptr.To(false)},
			{deleted: editorTier, client: editor, source: &source{Tier: tierFolder, Name: cTier}, preload: ptr.To(true)},
			{deleted: cTier, client: admin, source: &source{Tier: tierFolder, Name: pTier}, preload: ptr.To(false)},
			{deleted: pTier, client: admin, source: &source{Tier: tierFolder}, preload: ptr.To(true)},
			{deleted: gTier, client: admin, source: &source{Tier: tierOrg, Name: "namespace"}, preload: ptr.To(false)},
			{deleted: "namespace", client: admin},
		} {
			when := "at the start"
			if step.deleted != "" {
				require.NoError(t, step.client.Resource.Delete(ctx, step.deleted, metav1.DeleteOptions{}), "DELETE %s", step.deleted)
				when = "after deleting " + step.deleted
			}
			rsp := getMergedDashboardPreferences(t, helper, helper.Org1.Editor, inC)
			require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "%s: %s", when, rsp.Body)

			got, found := rsp.Result.Sources["dashboard.preload"]
			if step.source == nil {
				require.False(t, found, "%s: expected no source, got %+v", when, got)
			} else {
				require.Equal(t, *step.source, got, when)
			}
			var preload *bool
			if rsp.Result.Spec.Dashboard != nil {
				preload = rsp.Result.Spec.Dashboard.Preload
			}
			require.Equal(t, step.preload, preload, when)
		}
	})
}

// createDashboardPreferencesChildFolder creates a folder inside parentUID as the org admin and returns its UID.
func createDashboardPreferencesChildFolder(t *testing.T, helper *apis.K8sTestHelper, title, parentUID string) string {
	t.Helper()
	body, err := json.Marshal(map[string]string{"title": title, "parentUid": parentUID})
	require.NoError(t, err)
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin, Method: http.MethodPost, Path: "/api/folders", Body: body, ContentType: "application/json",
	}, &struct {
		UID string `json:"uid"`
	}{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))
	return rsp.Result.UID
}

// getMergedDashboardPreferences GETs merged as user, or without credentials for a zero User. A 200 body must
// decode with no unknown fields. Any other response gets its Status, which DoRequest recognizes only by its kind:
// the authorizer's errors carry one, and the handler's don't.
func getMergedDashboardPreferences(t *testing.T, helper *apis.K8sTestHelper, user apis.User, query url.Values) apis.K8sResponse[dashv2beta1.DashboardPreferencesMerged] {
	t.Helper()
	path := "/apis/dashboard.grafana.app/v2beta1/namespaces/" + helper.Namespacer(helper.Org1.OrgID) + "/dashboardpreferences/merged"
	if len(query) > 0 {
		path += "?" + query.Encode()
	}
	rsp := apis.DoRequest(helper, apis.RequestParams{User: user, Path: path}, &dashv2beta1.DashboardPreferencesMerged{})

	if rsp.Response.StatusCode != http.StatusOK {
		if rsp.Status == nil {
			rsp.Status = &metav1.Status{}
			require.NoError(t, json.Unmarshal(rsp.Body, rsp.Status), "error body %s", rsp.Body)
		}
		rsp.Result = nil
		return rsp
	}

	// DoRequest decodes loosely, so a field the type doesn't know would go unchecked.
	merged := &dashv2beta1.DashboardPreferencesMerged{}
	decoder := json.NewDecoder(bytes.NewReader(rsp.Body))
	decoder.DisallowUnknownFields()
	require.NoError(t, decoder.Decode(merged), "merged body %s", rsp.Body)
	rsp.Result = merged
	return rsp
}

func mergedDashboardPreferencesSpecJSON(t *testing.T, rsp apis.K8sResponse[dashv2beta1.DashboardPreferencesMerged]) string {
	t.Helper()
	raw, err := json.Marshal(rsp.Result.Spec)
	require.NoError(t, err)
	return string(raw)
}
