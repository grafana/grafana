package dashboards

// Integration tests for the /kv subresource on dashboards.
//
// These tests run an embedded Grafana server with the storage.resourceKV
// feature toggle enabled and verify the authz/lifecycle/RV invariants
// of the KV subresource.
//
// The test matrix:
//   - Viewer (with parent read via folder permission) can GET kv: 200 or 404.
//   - Viewer PUT → 403 (no kv:write grant).
//   - SA with kv:write on kv:owner:usageinsights.grafana.app: PUT succeeds (204)
//     and GET returns the exact stored JSON.
//   - SA with kv:write on a different owner → 403.
//   - User without parent-read → 403/404 on GET kv.
//   - Unauthenticated request → 401.
//   - KV write does not change the dashboard's resourceVersion.
//   - Re-creating a dashboard with the same name starts with empty KV (create
//     clears the name prefix).

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var dashKVGVR = schema.GroupVersionResource{
	Group:    dashboardV1.APIGroup,
	Version:  dashboardV1.APIVersion,
	Resource: "dashboards",
}

// kvDashHelper wraps low-level HTTP calls for the /kv subresource on dashboards.
type kvDashHelper struct {
	t      *testing.T
	helper *apis.K8sTestHelper
}

func (k *kvDashHelper) path(ns, name, owner, key string) string {
	return fmt.Sprintf("/apis/%s/%s/namespaces/%s/dashboards/%s/kv/%s/%s",
		dashboardV1.APIGroup, dashboardV1.APIVersion, ns, name, owner, key)
}

func (k *kvDashHelper) listPath(ns, name string) string {
	return fmt.Sprintf("/apis/%s/%s/namespaces/%s/dashboards/%s/kv",
		dashboardV1.APIGroup, dashboardV1.APIVersion, ns, name)
}

func (k *kvDashHelper) doWithToken(method, path string, body []byte, token string) *http.Response {
	k.t.Helper()
	baseURL := fmt.Sprintf("http://%s", k.helper.GetEnv().Server.HTTPServer.Listener.Addr())
	var req *http.Request
	var err error
	if body != nil {
		req, err = http.NewRequest(method, baseURL+path, bytes.NewReader(body))
	} else {
		req, err = http.NewRequest(method, baseURL+path, nil)
	}
	require.NoError(k.t, err)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(k.t, err)
	return resp
}

func (k *kvDashHelper) putWithToken(token, ns, name, owner, key string, body []byte) *http.Response {
	k.t.Helper()
	return k.doWithToken(http.MethodPut, k.path(ns, name, owner, key), body, token)
}

func (k *kvDashHelper) getWithToken(token, ns, name, owner, key string) *http.Response {
	k.t.Helper()
	return k.doWithToken(http.MethodGet, k.path(ns, name, owner, key), nil, token)
}

func (k *kvDashHelper) getAsUser(user apis.User, ns, name, owner, key string) *http.Response {
	k.t.Helper()
	resp := apis.DoRequest(k.helper, apis.RequestParams{
		User:   user,
		Method: http.MethodGet,
		Path:   k.path(ns, name, owner, key),
	}, &map[string]interface{}{})
	return resp.Response
}

func (k *kvDashHelper) putAsUser(user apis.User, ns, name, owner, key string, body []byte) *http.Response {
	k.t.Helper()
	resp := apis.DoRequest(k.helper, apis.RequestParams{
		User:        user,
		Method:      http.MethodPut,
		Path:        k.path(ns, name, owner, key),
		Body:        body,
		ContentType: "application/json",
	}, &map[string]interface{}{})
	return resp.Response
}

// grantKVWriteDashboard inserts RBAC rows so that the given service account has
// kv:write on kv:owner:{owner} in the given org. Mirrors the pattern used
// in pkg/tests/apis/playlist/playlist_test.go for custom RBAC grants.
func grantKVWriteDashboard(t *testing.T, h *apis.K8sTestHelper, orgID, saID int64, owner string) {
	t.Helper()
	ctx := context.Background()
	err := h.GetEnv().SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		roleName := fmt.Sprintf("managed:serviceaccount:%d:kv-write-dash-%s", saID, owner)
		roleUID := fmt.Sprintf("kv_write_dash_%d_%d", saID, time.Now().UnixNano())
		role := &accesscontrol.Role{
			OrgID:   orgID,
			UID:     roleUID,
			Name:    roleName,
			Updated: time.Now(),
			Created: time.Now(),
		}
		if _, err := sess.Insert(role); err != nil {
			return err
		}
		userRole := &accesscontrol.UserRole{
			OrgID:   orgID,
			RoleID:  role.ID,
			UserID:  saID,
			Created: time.Now(),
		}
		if _, err := sess.Insert(userRole); err != nil {
			return err
		}
		perm := accesscontrol.Permission{
			RoleID:  role.ID,
			Action:  "kv:write",
			Scope:   "kv:owner:" + owner,
			Created: time.Now(),
			Updated: time.Now(),
		}
		perm.Kind, perm.Attribute, perm.Identifier = perm.SplitScope()
		_, err := sess.Insert(&perm)
		return err
	})
	require.NoError(t, err)
}

// createKVTestDashboard creates a dashboard in the given folder and returns its
// k8s name and initial resourceVersion.
func createKVTestDashboard(t *testing.T, client *apis.K8sResourceClient, title, folderUID string) (name, rv string) {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]interface{}{
		"spec": map[string]interface{}{
			"title":         title,
			"schemaVersion": 42,
		},
	}}
	obj.SetGenerateName("kv-dash-test-")
	obj.SetAPIVersion(dashKVGVR.GroupVersion().String())
	obj.SetKind("Dashboard")
	if folderUID != "" {
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	}
	created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
	})
	return created.GetName(), created.GetResourceVersion()
}

func TestIntegrationKV_Dashboards(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagStorageResourceKV,
		},
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"dashboards.dashboard.grafana.app": {DualWriterMode: 5},
			"folders.folder.grafana.app":       {DualWriterMode: 5},
		},
	})
	defer h.Shutdown()

	ctx := context.Background()
	ns := h.Namespacer(h.Org1.Admin.Identity.GetOrgID())

	adminClient := h.GetResourceClient(apis.ResourceClientArgs{
		User: h.Org1.Admin,
		GVR:  dashKVGVR,
	})
	kv := &kvDashHelper{t: t, helper: h}

	// ── Test folder ──────────────────────────────────────────────────────────
	// Production RBAC with unified storage requires folder-level view permission
	// for reading dashboards.
	const testFolderUID = "kv-dash-integration-folder"
	createFolder(t, ctx, h, testFolderUID, "KV Dashboard Integration Test")

	// ── Participants ─────────────────────────────────────────────────────────
	const owner = "usageinsights.grafana.app"
	const otherOwner = "other-app.grafana.app"
	const kvKey = "stats"
	statsValue := []byte(`{"views_total":42}`)

	viewerID, err := identity.UserIdentifier(h.Org1.Viewer.Identity.GetID())
	require.NoError(t, err)

	// SA with kv:write on the test owner.
	permittedSA := h.CreateServiceAccount(h.Org1.Admin, "kv-dash-permitted-sa",
		h.Org1.Admin.Identity.GetOrgID(), org.RoleViewer)
	permittedToken := h.CreateServiceAccountToken(
		h.Org1.Admin, permittedSA.Id, h.Org1.Admin.Identity.GetOrgID(), "kv-dash-token", 0)
	grantKVWriteDashboard(t, h, h.Org1.Admin.Identity.GetOrgID(), permittedSA.Id, owner)

	// SA with kv:write on a DIFFERENT owner — must not write under 'owner'.
	wrongOwnerSA := h.CreateServiceAccount(h.Org1.Admin, "kv-dash-wrongowner-sa",
		h.Org1.Admin.Identity.GetOrgID(), org.RoleViewer)
	wrongOwnerToken := h.CreateServiceAccountToken(
		h.Org1.Admin, wrongOwnerSA.Id, h.Org1.Admin.Identity.GetOrgID(), "kv-dash-wrong-token", 0)
	grantKVWriteDashboard(t, h, h.Org1.Admin.Identity.GetOrgID(), wrongOwnerSA.Id, otherOwner)

	// SA with folder-view but no kv:write at all.
	deniedSA := h.CreateServiceAccount(h.Org1.Admin, "kv-dash-denied-sa",
		h.Org1.Admin.Identity.GetOrgID(), org.RoleViewer)
	deniedToken := h.CreateServiceAccountToken(
		h.Org1.Admin, deniedSA.Id, h.Org1.Admin.Identity.GetOrgID(), "kv-dash-denied-token", 0)

	// SA with no folder permissions — proves the parent-read gate.
	noAccessSA := h.CreateServiceAccount(h.Org1.Admin, "kv-dash-noaccess-sa",
		h.Org1.Admin.Identity.GetOrgID(), org.RoleViewer)
	noAccessToken := h.CreateServiceAccountToken(
		h.Org1.Admin, noAccessSA.Id, h.Org1.Admin.Identity.GetOrgID(), "kv-dash-noaccess-token", 0)

	// Grant folder view to every identity that needs to reach the KV handler.
	// noAccessSA is intentionally excluded.
	setFolderPermissions(t, h, h.Org1.Admin, testFolderUID, []ResourcePermissionSetting{
		{UserID: &viewerID, Level: ResourcePermissionLevelView},
		{UserID: &permittedSA.Id, Level: ResourcePermissionLevelView},
		{UserID: &wrongOwnerSA.Id, Level: ResourcePermissionLevelView},
		{UserID: &deniedSA.Id, Level: ResourcePermissionLevelView},
	})

	// ── Create test dashboard ────────────────────────────────────────────────
	dashName, initialRV := createKVTestDashboard(t, adminClient, "KV Test Dashboard", testFolderUID)
	t.Logf("created dashboard: name=%s rv=%s", dashName, initialRV)

	// ── Authz: viewer GET ok (200 or 404, not 403) ───────────────────────────
	t.Run("viewer_GET_kv_not_forbidden", func(t *testing.T) {
		resp := kv.getAsUser(h.Org1.Viewer, ns, dashName, owner, kvKey)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.NotEqual(t, http.StatusForbidden, resp.StatusCode,
			"viewer GET must not be forbidden (got %d); viewer has parent-read via folder permission", resp.StatusCode)
	})

	// ── Authz: viewer PUT → 403 ──────────────────────────────────────────────
	t.Run("viewer_PUT_kv_403", func(t *testing.T) {
		resp := kv.putAsUser(h.Org1.Viewer, ns, dashName, owner, kvKey, statsValue)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusForbidden, resp.StatusCode,
			"viewer PUT must return 403 — viewer has no kv:write grant")
	})

	// ── SA with kv:write can PUT (204 No Content) and GET back ───────────────
	t.Run("SA_with_kv_write_can_PUT_204", func(t *testing.T) {
		resp := kv.putWithToken(permittedToken, ns, dashName, owner, kvKey, statsValue)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusNoContent, resp.StatusCode,
			"SA with kv:write must receive 204 No Content on PUT")
	})

	t.Run("SA_with_kv_write_can_GET_back_exact_value", func(t *testing.T) {
		// Write a known value first.
		putResp := kv.putWithToken(permittedToken, ns, dashName, owner, kvKey, statsValue)
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		// Read it back.
		getResp := kv.getWithToken(permittedToken, ns, dashName, owner, kvKey)
		t.Cleanup(func() { _ = getResp.Body.Close() })
		require.Equal(t, http.StatusOK, getResp.StatusCode, "GET after PUT must return 200")
		assert.Equal(t, "application/json", getResp.Header.Get("Content-Type"))

		var body map[string]interface{}
		require.NoError(t, json.NewDecoder(getResp.Body).Decode(&body))
		assert.Equal(t, float64(42), body["views_total"],
			"GET must return exactly the JSON that was PUT")
	})

	// ── SA with kv:write for wrong owner → 403 ───────────────────────────────
	t.Run("SA_with_wrong_owner_grant_403", func(t *testing.T) {
		resp := kv.putWithToken(wrongOwnerToken, ns, dashName, owner, kvKey, statsValue)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusForbidden, resp.StatusCode,
			"SA with kv:write on %q must get 403 when writing to %q", otherOwner, owner)
	})

	// SA without any kv:write must also be denied.
	t.Run("SA_without_kv_write_grant_403", func(t *testing.T) {
		resp := kv.putWithToken(deniedToken, ns, dashName, owner, kvKey, statsValue)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusForbidden, resp.StatusCode,
			"SA without kv:write must get 403")
	})

	// ── User without parent read → 403/404 ──────────────────────────────────
	t.Run("user_without_parent_read_403", func(t *testing.T) {
		resp := kv.getWithToken(noAccessToken, ns, dashName, owner, kvKey)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.True(t,
			resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound,
			"user without parent-read must get 403 or 404 on GET kv (got %d)", resp.StatusCode)
	})

	// ── Unauthenticated → 401 ────────────────────────────────────────────────
	t.Run("anonymous_rejected_401", func(t *testing.T) {
		// No Authorization header.
		resp := kv.doWithToken(http.MethodGet, kv.path(ns, dashName, owner, kvKey), nil, "")
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
			"unauthenticated request must be rejected with 401")
	})

	// ── KV write must not change the dashboard's resourceVersion ─────────────
	t.Run("KV_write_does_not_bump_resourceVersion", func(t *testing.T) {
		putResp := kv.putWithToken(permittedToken, ns, dashName, owner, kvKey, []byte(`{"views_total":100}`))
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		updated, err := adminClient.Resource.Get(ctx, dashName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, initialRV, updated.GetResourceVersion(),
			"KV write must NOT change the dashboard's resourceVersion")
	})

	// ── List keys returns {"keys":[…]} ───────────────────────────────────────
	t.Run("list_keys_returns_keys_array", func(t *testing.T) {
		// Ensure at least one value exists.
		putResp := kv.putWithToken(permittedToken, ns, dashName, owner, kvKey, statsValue)
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		listResp := kv.doWithToken(http.MethodGet, kv.listPath(ns, dashName), nil, permittedToken)
		t.Cleanup(func() { _ = listResp.Body.Close() })
		require.Equal(t, http.StatusOK, listResp.StatusCode, "list keys must return 200")
		assert.Equal(t, "application/json", listResp.Header.Get("Content-Type"))

		var listBody struct {
			Keys []string `json:"keys"`
		}
		require.NoError(t, json.NewDecoder(listResp.Body).Decode(&listBody))
		assert.NotNil(t, listBody.Keys, "keys field must not be null")
	})

	// ── Name-based isolation: re-created dashboard starts with empty KV ──────
	t.Run("recreated_dashboard_same_name_starts_empty", func(t *testing.T) {
		// Create a dedicated dashboard for this subtest.
		newName, _ := createKVTestDashboard(t, adminClient, "Reuse Name KV Test", testFolderUID)

		putResp := kv.putWithToken(permittedToken, ns, newName, owner, kvKey, []byte(`{"views_total":777}`))
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		firstObj, err := adminClient.Resource.Get(ctx, newName, metav1.GetOptions{})
		require.NoError(t, err)
		firstUID := string(firstObj.GetUID())

		// Delete the dashboard.
		zero := int64(0)
		require.NoError(t, adminClient.Resource.Delete(ctx, newName, metav1.DeleteOptions{
			GracePeriodSeconds: &zero,
		}))

		// Re-create with the same name in the same folder.
		recreated := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":         "Reuse Name KV Test",
				"schemaVersion": 42,
			},
		}}
		recreated.SetName(newName)
		recreated.SetAPIVersion(dashKVGVR.GroupVersion().String())
		recreated.SetKind("Dashboard")
		recreated.SetAnnotations(map[string]string{utils.AnnoKeyFolder: testFolderUID})

		second, err := adminClient.Resource.Create(ctx, recreated, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = adminClient.Resource.Delete(ctx, second.GetName(), metav1.DeleteOptions{})
		})
		secondUID := string(second.GetUID())

		require.NotEqual(t, firstUID, secondUID,
			"re-created object must have a new UID (create clears the name prefix)")

		// The new incarnation must have empty KV: the create clears the name prefix.
		getResp := kv.getWithToken(permittedToken, ns, newName, owner, kvKey)
		t.Cleanup(func() { _ = getResp.Body.Close() })
		assert.Equal(t, http.StatusNotFound, getResp.StatusCode,
			"re-created dashboard must start with empty KV (create clears name prefix)")
	})

	// ── Delete then immediately re-create → KV empty ─────────────────────────
	// Verifies the synchronous clear-on-create is sufficient even when the
	// asynchronous delete-time cleanup has not yet run. The delete and re-create
	// happen back-to-back without any delay.
	t.Run("delete_recreate_same_name_kv_empty", func(t *testing.T) {
		const fixedName = "kv-dash-del-recreate"

		// Create with an explicit name.
		delRecreateObj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":         "Del-Recreate KV Test",
				"schemaVersion": 42,
			},
		}}
		delRecreateObj.SetName(fixedName)
		delRecreateObj.SetAPIVersion(dashKVGVR.GroupVersion().String())
		delRecreateObj.SetKind("Dashboard")
		delRecreateObj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: testFolderUID})

		first, err := adminClient.Resource.Create(ctx, delRecreateObj, metav1.CreateOptions{})
		require.NoError(t, err)

		// Write a KV entry under the first incarnation.
		putResp := kv.putWithToken(permittedToken, ns, fixedName, owner, kvKey, []byte(`{"views_total":999}`))
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		// Delete immediately (grace=0).
		zero := int64(0)
		require.NoError(t, adminClient.Resource.Delete(ctx, fixedName, metav1.DeleteOptions{
			GracePeriodSeconds: &zero,
		}))
		// Do NOT wait for async cleanup — the clear-on-create must be sufficient.

		// Re-create with the same name.
		second, err := adminClient.Resource.Create(ctx, delRecreateObj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = adminClient.Resource.Delete(ctx, second.GetName(), metav1.DeleteOptions{})
		})

		require.NotEqual(t, string(first.GetUID()), string(second.GetUID()),
			"re-created object must have a new UID")

		// The create clear must have wiped the KV from the previous incarnation.
		getResp := kv.getWithToken(permittedToken, ns, fixedName, owner, kvKey)
		t.Cleanup(func() { _ = getResp.Body.Close() })
		assert.Equal(t, http.StatusNotFound, getResp.StatusCode,
			"re-created dashboard must start with empty KV (clear-on-create)")
	})

	// ── Conflict create (409) must not wipe existing KV ──────────────────────
	// A failed create (name already exists) must leave the live object's KV
	// rows intact.
	t.Run("conflict_409_existing_kv_intact", func(t *testing.T) {
		const fixedName = "kv-dash-conflict-test"

		conflictObj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":         "Conflict KV Test",
				"schemaVersion": 42,
			},
		}}
		conflictObj.SetName(fixedName)
		conflictObj.SetAPIVersion(dashKVGVR.GroupVersion().String())
		conflictObj.SetKind("Dashboard")
		conflictObj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: testFolderUID})

		// First create succeeds.
		_, err := adminClient.Resource.Create(ctx, conflictObj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = adminClient.Resource.Delete(ctx, fixedName, metav1.DeleteOptions{})
		})

		// Write KV under the live object.
		putResp := kv.putWithToken(permittedToken, ns, fixedName, owner, kvKey, statsValue)
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		// Second create → must fail with 409 (AlreadyExists / Conflict).
		_, err = adminClient.Resource.Create(ctx, conflictObj, metav1.CreateOptions{})
		require.Error(t, err, "second create of the same name must fail")

		getResp := kv.getWithToken(permittedToken, ns, fixedName, owner, kvKey)
		t.Cleanup(func() { _ = getResp.Body.Close() })
		assert.Equal(t, http.StatusOK, getResp.StatusCode,
			"existing object's KV must be intact after a failed (409) create")
	})

	// ── Kind without kv declaration → 404 ────────────────────────────────────
	t.Run("folder_without_kv_declaration_404", func(t *testing.T) {
		// folders.folder.grafana.app does NOT declare kv; its /kv path must be 404.
		folderKVPath := fmt.Sprintf("/apis/folder.grafana.app/v1beta1/namespaces/%s/folders/%s/kv",
			ns, testFolderUID)
		resp := kv.doWithToken(http.MethodGet, folderKVPath, nil, permittedToken)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusNotFound, resp.StatusCode,
			"a kind without kv declaration (folders) must return 404 for the /kv subresource")
	})
}
