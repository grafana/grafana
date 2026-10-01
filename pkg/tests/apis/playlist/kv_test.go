package playlist

// Integration tests for the /kv subresource on playlists.
//
// Playlists are served by an app-installer (not a builder), so this test verifies
// that the generic kv mount works for app-installer kinds as well.
//
// Design:
//   - Playlists are NOT folder-scoped; viewers get playlists:read via their org role.
//   - The parent-read gate fires through the KVConnector's getter (same as dashboards).
//   - A service account with kv:write on kv:owner:usageinsights.grafana.app can
//     write; one with the grant only for another owner gets 403.
//   - A user with no playlists:read gets 403 on GET kv (parent-read fails).
//   - KV write does not change the playlist's resourceVersion.

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

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var playlistKVGVR = schema.GroupVersionResource{
	Group:    "playlist.grafana.app",
	Version:  "v1",
	Resource: "playlists",
}

// kvPlaylistHelper wraps low-level HTTP calls for the /kv subresource on playlists.
type kvPlaylistHelper struct {
	t      *testing.T
	helper *apis.K8sTestHelper
}

func (k *kvPlaylistHelper) path(ns, name, owner, key string) string {
	return fmt.Sprintf("/apis/playlist.grafana.app/v1/namespaces/%s/playlists/%s/kv/%s/%s",
		ns, name, owner, key)
}

func (k *kvPlaylistHelper) listPath(ns, name string) string {
	return fmt.Sprintf("/apis/playlist.grafana.app/v1/namespaces/%s/playlists/%s/kv",
		ns, name)
}

func (k *kvPlaylistHelper) doWithToken(method, path string, body []byte, token string) *http.Response {
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

func (k *kvPlaylistHelper) getAsUser(user apis.User, ns, name, owner, key string) *http.Response {
	k.t.Helper()
	resp := apis.DoRequest(k.helper, apis.RequestParams{
		User:   user,
		Method: http.MethodGet,
		Path:   k.path(ns, name, owner, key),
	}, &map[string]interface{}{})
	return resp.Response
}

func (k *kvPlaylistHelper) putAsUser(user apis.User, ns, name, owner, key string, body []byte) *http.Response {
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

// grantKVWritePlaylist inserts RBAC rows so that the given service account has
// kv:write on kv:owner:{owner} in the given org.
func grantKVWritePlaylist(t *testing.T, h *apis.K8sTestHelper, orgID, saID int64, owner string) {
	t.Helper()
	ctx := context.Background()
	err := h.GetEnv().SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		roleName := fmt.Sprintf("managed:serviceaccount:%d:kv-write-playlist-%s", saID, owner)
		roleUID := fmt.Sprintf("kv_write_playlist_%d_%d", saID, time.Now().UnixNano())
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

// createKVTestPlaylist creates a minimal playlist and returns its k8s name and
// initial resourceVersion.
func createKVTestPlaylist(t *testing.T, client *apis.K8sResourceClient, title string) (name, rv string) {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]interface{}{
		"spec": map[string]interface{}{
			"title":    title,
			"interval": "5m",
			"items":    []interface{}{},
		},
	}}
	obj.SetGenerateName("kv-playlist-test-")
	obj.SetAPIVersion(playlistKVGVR.GroupVersion().String())
	obj.SetKind("Playlist")

	created, err := client.Resource.Create(context.Background(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Resource.Delete(context.Background(), created.GetName(), metav1.DeleteOptions{})
	})
	return created.GetName(), created.GetResourceVersion()
}

func TestIntegrationKV_Playlists(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	h := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagStorageResourceKV,
			"playlistsRBAC",
		},
	})
	defer h.Shutdown()

	ctx := context.Background()
	ns := h.Namespacer(h.Org1.Admin.Identity.GetOrgID())

	adminClient := h.GetResourceClient(apis.ResourceClientArgs{
		User: h.Org1.Admin,
		GVR:  playlistKVGVR,
	})
	kv := &kvPlaylistHelper{t: t, helper: h}

	// ── Participants ─────────────────────────────────────────────────────────
	const owner = "usageinsights.grafana.app"
	const otherOwner = "other-app.grafana.app"
	const kvKey = "stats"
	statsValue := []byte(`{"playlist_opens":99}`)

	// SA with kv:write on the test owner.
	permittedSA := h.CreateServiceAccount(h.Org1.Admin, "kv-playlist-permitted-sa",
		h.Org1.Admin.Identity.GetOrgID(), org.RoleViewer)
	permittedToken := h.CreateServiceAccountToken(
		h.Org1.Admin, permittedSA.Id, h.Org1.Admin.Identity.GetOrgID(), "kv-playlist-token", 0)
	grantKVWritePlaylist(t, h, h.Org1.Admin.Identity.GetOrgID(), permittedSA.Id, owner)

	// SA with kv:write on a DIFFERENT owner.
	wrongOwnerSA := h.CreateServiceAccount(h.Org1.Admin, "kv-playlist-wrongowner-sa",
		h.Org1.Admin.Identity.GetOrgID(), org.RoleViewer)
	wrongOwnerToken := h.CreateServiceAccountToken(
		h.Org1.Admin, wrongOwnerSA.Id, h.Org1.Admin.Identity.GetOrgID(), "kv-playlist-wrong-token", 0)
	grantKVWritePlaylist(t, h, h.Org1.Admin.Identity.GetOrgID(), wrongOwnerSA.Id, otherOwner)

	// SA with no kv:write grant.
	deniedSA := h.CreateServiceAccount(h.Org1.Admin, "kv-playlist-denied-sa",
		h.Org1.Admin.Identity.GetOrgID(), org.RoleViewer)
	deniedToken := h.CreateServiceAccountToken(
		h.Org1.Admin, deniedSA.Id, h.Org1.Admin.Identity.GetOrgID(), "kv-playlist-denied-token", 0)

	// User with RoleNone proves the parent-read gate: they can authenticate but
	// have no playlists:read permission and must receive 403 or 404 on GET kv.
	noAccessUser := h.CreateUser("kv-playlist-noaccess", apis.Org1, org.RoleNone, nil)

	// ── Create a test playlist ───────────────────────────────────────────────
	playlistName, initialRV := createKVTestPlaylist(t, adminClient, "KV Test Playlist")
	t.Logf("created playlist: name=%s rv=%s", playlistName, initialRV)

	// ── Authz: viewer GET ok (200 or 404, not 403) ───────────────────────────
	// Viewers have playlists:read via the viewer role, so they can read the parent.
	t.Run("viewer_GET_kv_not_forbidden", func(t *testing.T) {
		resp := kv.getAsUser(h.Org1.Viewer, ns, playlistName, owner, kvKey)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.NotEqual(t, http.StatusForbidden, resp.StatusCode,
			"viewer GET kv must not be forbidden (got %d); viewer has playlists:read", resp.StatusCode)
	})

	// ── Authz: viewer PUT → 403 ──────────────────────────────────────────────
	t.Run("viewer_PUT_kv_403", func(t *testing.T) {
		resp := kv.putAsUser(h.Org1.Viewer, ns, playlistName, owner, kvKey, statsValue)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusForbidden, resp.StatusCode,
			"viewer PUT kv must return 403 — viewer has no kv:write grant")
	})

	// ── SA with kv:write can PUT (204) and GET back the exact value ──────────
	t.Run("SA_with_kv_write_can_PUT_204", func(t *testing.T) {
		resp := kv.doWithToken(http.MethodPut,
			kv.path(ns, playlistName, owner, kvKey), statsValue, permittedToken)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusNoContent, resp.StatusCode,
			"SA with kv:write must receive 204 No Content on PUT")
	})

	t.Run("SA_with_kv_write_can_GET_back_exact_value", func(t *testing.T) {
		putResp := kv.doWithToken(http.MethodPut,
			kv.path(ns, playlistName, owner, kvKey), statsValue, permittedToken)
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		getResp := kv.doWithToken(http.MethodGet,
			kv.path(ns, playlistName, owner, kvKey), nil, permittedToken)
		t.Cleanup(func() { _ = getResp.Body.Close() })
		require.Equal(t, http.StatusOK, getResp.StatusCode, "GET after PUT must return 200")
		assert.Equal(t, "application/json", getResp.Header.Get("Content-Type"))

		var body map[string]interface{}
		require.NoError(t, json.NewDecoder(getResp.Body).Decode(&body))
		assert.Equal(t, float64(99), body["playlist_opens"],
			"GET must return exactly the JSON that was PUT")
	})

	// ── SA with kv:write for wrong owner → 403 ───────────────────────────────
	t.Run("SA_with_wrong_owner_grant_403", func(t *testing.T) {
		resp := kv.doWithToken(http.MethodPut,
			kv.path(ns, playlistName, owner, kvKey), statsValue, wrongOwnerToken)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusForbidden, resp.StatusCode,
			"SA with kv:write on %q must get 403 when writing to %q", otherOwner, owner)
	})

	// SA without any kv:write.
	t.Run("SA_without_kv_write_grant_403", func(t *testing.T) {
		resp := kv.doWithToken(http.MethodPut,
			kv.path(ns, playlistName, owner, kvKey), statsValue, deniedToken)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusForbidden, resp.StatusCode,
			"SA without kv:write must get 403")
	})

	// ── User without parent-read → 403/404 ──────────────────────────────────
	// The KV connector's parent-read gate enforces playlists:read. A user with
	// org.RoleNone (no playlists:read) must receive 403 or 404 on GET kv.
	t.Run("user_without_parent_read_403_or_404", func(t *testing.T) {
		resp := kv.getAsUser(noAccessUser, ns, playlistName, owner, kvKey)
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.True(t,
			resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound,
			"user without playlists:read must get 403 or 404 on GET kv (got %d)", resp.StatusCode)
	})

	// ── Unauthenticated → 401 ────────────────────────────────────────────────
	t.Run("anonymous_rejected_401", func(t *testing.T) {
		resp := kv.doWithToken(http.MethodGet, kv.path(ns, playlistName, owner, kvKey), nil, "")
		t.Cleanup(func() { _ = resp.Body.Close() })
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode,
			"unauthenticated request must be rejected with 401")
	})

	// ── KV write does not change the playlist's resourceVersion ──────────────
	t.Run("KV_write_does_not_bump_resourceVersion", func(t *testing.T) {
		putResp := kv.doWithToken(http.MethodPut,
			kv.path(ns, playlistName, owner, kvKey), []byte(`{"playlist_opens":200}`), permittedToken)
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		updated, err := adminClient.Resource.Get(ctx, playlistName, metav1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, initialRV, updated.GetResourceVersion(),
			"KV write must NOT change the playlist's resourceVersion")
	})

	// ── List keys returns {"keys":[…]} ───────────────────────────────────────
	t.Run("list_keys_returns_keys_array", func(t *testing.T) {
		putResp := kv.doWithToken(http.MethodPut,
			kv.path(ns, playlistName, owner, kvKey), statsValue, permittedToken)
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		listResp := kv.doWithToken(http.MethodGet, kv.listPath(ns, playlistName), nil, permittedToken)
		t.Cleanup(func() { _ = listResp.Body.Close() })
		require.Equal(t, http.StatusOK, listResp.StatusCode, "list keys must return 200")

		var listBody struct {
			Keys []string `json:"keys"`
		}
		require.NoError(t, json.NewDecoder(listResp.Body).Decode(&listBody))
		assert.NotNil(t, listBody.Keys, "keys field must not be null")
	})

	// ── Name-based isolation: re-created playlist starts with empty KV ───────
	t.Run("recreated_playlist_same_name_starts_empty", func(t *testing.T) {
		newName, _ := createKVTestPlaylist(t, adminClient, "Reuse Name Playlist KV Test")

		putResp := kv.doWithToken(http.MethodPut,
			kv.path(ns, newName, owner, kvKey), []byte(`{"playlist_opens":555}`), permittedToken)
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		firstObj, err := adminClient.Resource.Get(ctx, newName, metav1.GetOptions{})
		require.NoError(t, err)
		firstUID := string(firstObj.GetUID())

		// Delete the playlist.
		zero := int64(0)
		require.NoError(t, adminClient.Resource.Delete(ctx, newName, metav1.DeleteOptions{
			GracePeriodSeconds: &zero,
		}))

		// Re-create with an explicit name (playlists use generateName but we can
		// also set a fixed name).
		recreated := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":    "Reuse Name Playlist KV Test",
				"interval": "5m",
				"items":    []interface{}{},
			},
		}}
		recreated.SetName(newName)
		recreated.SetAPIVersion(playlistKVGVR.GroupVersion().String())
		recreated.SetKind("Playlist")

		second, err := adminClient.Resource.Create(ctx, recreated, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = adminClient.Resource.Delete(ctx, second.GetName(), metav1.DeleteOptions{})
		})
		secondUID := string(second.GetUID())

		require.NotEqual(t, firstUID, secondUID,
			"re-created object must have a new UID (create clears the name prefix)")

		getResp := kv.doWithToken(http.MethodGet,
			kv.path(ns, newName, owner, kvKey), nil, permittedToken)
		t.Cleanup(func() { _ = getResp.Body.Close() })
		assert.Equal(t, http.StatusNotFound, getResp.StatusCode,
			"re-created playlist must start with empty KV (create clears name prefix)")
	})

	// ── Delete then immediately re-create → KV empty ─────────────────────────
	// Verifies the synchronous clear-on-create is sufficient even when the
	// asynchronous delete-time cleanup has not yet run.
	t.Run("delete_recreate_same_name_kv_empty", func(t *testing.T) {
		const fixedName = "kv-playlist-del-recreate"

		delRecreateObj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":    "Del-Recreate Playlist KV Test",
				"interval": "5m",
				"items":    []interface{}{},
			},
		}}
		delRecreateObj.SetName(fixedName)
		delRecreateObj.SetAPIVersion(playlistKVGVR.GroupVersion().String())
		delRecreateObj.SetKind("Playlist")

		first, err := adminClient.Resource.Create(ctx, delRecreateObj, metav1.CreateOptions{})
		require.NoError(t, err)

		// Write a KV entry under the first incarnation.
		putResp := kv.doWithToken(http.MethodPut,
			kv.path(ns, fixedName, owner, kvKey), []byte(`{"playlist_opens":555}`), permittedToken)
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
		getResp := kv.doWithToken(http.MethodGet,
			kv.path(ns, fixedName, owner, kvKey), nil, permittedToken)
		t.Cleanup(func() { _ = getResp.Body.Close() })
		assert.Equal(t, http.StatusNotFound, getResp.StatusCode,
			"re-created playlist must start with empty KV (clear-on-create)")
	})

	// ── Conflict create (409) must not wipe existing KV ──────────────────────
	// A failed create (name already exists) must leave the live object's KV
	// rows intact.
	t.Run("conflict_409_existing_kv_intact", func(t *testing.T) {
		const fixedName = "kv-playlist-conflict-test"

		conflictObj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":    "Conflict Playlist KV Test",
				"interval": "5m",
				"items":    []interface{}{},
			},
		}}
		conflictObj.SetName(fixedName)
		conflictObj.SetAPIVersion(playlistKVGVR.GroupVersion().String())
		conflictObj.SetKind("Playlist")

		// First create succeeds.
		_, err := adminClient.Resource.Create(ctx, conflictObj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = adminClient.Resource.Delete(ctx, fixedName, metav1.DeleteOptions{})
		})

		// Write KV under the live object.
		putResp := kv.doWithToken(http.MethodPut,
			kv.path(ns, fixedName, owner, kvKey), statsValue, permittedToken)
		t.Cleanup(func() { _ = putResp.Body.Close() })
		require.Equal(t, http.StatusNoContent, putResp.StatusCode)

		// Second create → must fail (409 AlreadyExists / Conflict).
		_, err = adminClient.Resource.Create(ctx, conflictObj, metav1.CreateOptions{})
		require.Error(t, err, "second create of the same name must fail")

		getResp := kv.doWithToken(http.MethodGet,
			kv.path(ns, fixedName, owner, kvKey), nil, permittedToken)
		t.Cleanup(func() { _ = getResp.Body.Close() })
		assert.Equal(t, http.StatusOK, getResp.StatusCode,
			"existing object's KV must be intact after a failed (409) create")
	})
}
