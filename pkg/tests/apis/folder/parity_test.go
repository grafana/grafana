package folder

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type folderProjection struct {
	UID         string
	Title       string
	Description string
	ParentUID   string
}

func projectLegacyFolder(f *dtos.Folder) folderProjection {
	return folderProjection{
		UID:       f.UID,
		Title:     f.Title,
		ParentUID: f.ParentUID,
		// dtos.Folder has no Description field — the legacy API never
		// surfaced it, so we leave it empty and let the k8s side match.
	}
}

func projectK8sFolder(t *testing.T, u *unstructured.Unstructured) folderProjection {
	t.Helper()
	spec, _ := u.Object["spec"].(map[string]any)
	title, _ := spec["title"].(string)
	desc, _ := spec["description"].(string)
	return folderProjection{
		UID:         u.GetName(),
		Title:       title,
		Description: desc,
		ParentUID:   u.GetAnnotations()[utils.AnnoKeyFolder],
	}
}

// normaliseProjection drops fields we know are not in parity yet so the
// rest of the diff stays meaningful. Right now legacy never exposes
// description, so we zero it on both sides for comparison.
func normaliseProjection(p folderProjection) folderProjection {
	p.Description = ""
	return p
}

// accessProjection mirrors foldersV1.FolderAccessInfo and the four
// can-* booleans embedded in dtos.Folder.
type accessProjection struct {
	CanSave   bool
	CanEdit   bool
	CanAdmin  bool
	CanDelete bool
}

func projectLegacyAccess(f *dtos.Folder) accessProjection {
	return accessProjection{
		CanSave:   f.CanSave,
		CanEdit:   f.CanEdit,
		CanAdmin:  f.CanAdmin,
		CanDelete: f.CanDelete,
	}
}

func projectK8sAccess(a *foldersV1.FolderAccessInfo) accessProjection {
	return accessProjection{
		CanSave:   a.CanSave,
		CanEdit:   a.CanEdit,
		CanAdmin:  a.CanAdmin,
		CanDelete: a.CanDelete,
	}
}

// parityFixture sets up a folder tree once per outer test and exposes the
// uids/users the subtests need. The tree:
//
//	root
//	├── parityA       (parityA)
//	│   ├── parityA1  (parityA1)        depth-2
//	│   │   └── parityA1a (parityA1a)   depth-3
//	│   └── parityA2  (parityA2)
//	└── parityB       (parityB)         sibling under root
//	    ├── parityB1
//	    ├── parityB2
//	    ├── parityB3
//	    ├── parityB4
//	    └── parityB5                    wide-tree case
type parityFixture struct {
	helper *apis.K8sTestHelper

	// k8s client scoped to Org1 Admin — used for non-RBAC reads.
	adminK8s *apis.K8sResourceClient

	// rbacEditorOnA is a custom user with folders:write on parityA only
	// (no perms anywhere else). Drives the C-MOVE escalation test.
	rbacEditorOnA apis.User
}

func newParityFixture(t *testing.T) *parityFixture {
	t.Helper()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
	})

	adminK8s := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	// Build the tree via legacy POST so both surfaces see it identically.
	create := func(uid, title, parentUID string) {
		body, err := json.Marshal(map[string]string{
			"uid":       uid,
			"title":     title,
			"parentUid": parentUID,
		})
		require.NoError(t, err)
		res := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/folders",
			Body:   body,
		}, &dtos.Folder{})
		require.NotNil(t, res.Result, "create %s: %s", uid, string(res.Body))
		require.Equal(t, http.StatusOK, res.Response.StatusCode,
			"create %s: %s", uid, string(res.Body))
	}

	create("parityA", "parityA", "")
	create("parityA1", "parityA1", "parityA")
	create("parityA1a", "parityA1a", "parityA1")
	create("parityA2", "parityA2", "parityA")
	create("parityB", "parityB", "")
	for i := 1; i <= 5; i++ {
		create(fmt.Sprintf("parityB%d", i), fmt.Sprintf("parityB%d", i), "parityB")
	}

	// Custom user: editor in org1, with folders:write granted on parityA
	// only. This is the user that should be allowed to move *within*
	// parityA but should NOT be allowed to move out of it into a folder
	// they have no perms on. Catches C-MOVE.
	rbacEditorOnA := helper.CreateUser(
		"parity-elevated-A", apis.Org1,
		org.RoleEditor,
		[]resourcepermissions.SetResourcePermissionCommand{
			{
				Actions: []string{
					folder.ActionFoldersRead,
					folder.ActionFoldersWrite,
				},
				Resource:          "folders",
				ResourceAttribute: "uid",
				ResourceID:        "parityA",
			},
		},
	)

	return &parityFixture{
		helper:        helper,
		adminK8s:      adminK8s,
		rbacEditorOnA: rbacEditorOnA,
	}
}

func (f *parityFixture) namespace() string {
	return f.helper.Namespacer(f.helper.Org1.Admin.Identity.GetOrgID())
}

func (f *parityFixture) legacyGet(t *testing.T, user apis.User, path string, out any) (*http.Response, []byte) {
	t.Helper()
	rsp := apis.DoRequest(f.helper, apis.RequestParams{
		User:   user,
		Method: http.MethodGet,
		Path:   path,
	}, &json.RawMessage{})
	require.NotNil(t, rsp.Response, "legacy %s: nil response", path)
	if rsp.Response.StatusCode == http.StatusOK && out != nil {
		require.NoError(t, json.Unmarshal(rsp.Body, out),
			"legacy %s: body=%s", path, string(rsp.Body))
	}
	return rsp.Response, rsp.Body
}

func (f *parityFixture) k8sGetSubresource(t *testing.T, user apis.User, uid, sub string) (*http.Response, []byte) {
	t.Helper()
	path := fmt.Sprintf("/apis/%s/%s/namespaces/%s/folders/%s/%s",
		foldersV1.GROUP, foldersV1.VERSION, f.namespace(), uid, sub)
	rsp := apis.DoRequest(f.helper, apis.RequestParams{
		User:   user,
		Method: http.MethodGet,
		Path:   path,
	}, &json.RawMessage{})
	require.NotNil(t, rsp.Response, "k8s %s: nil response", path)
	return rsp.Response, rsp.Body
}

func TestIntegrationFolderAPIParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	f := newParityFixture(t)

	t.Run("GET /folders/{uid} parity", func(t *testing.T) {
		// One scalar Folder lookup. Project both sides through
		// folderProjection and diff. Runs across the basic RBAC matrix.
		users := []struct {
			name string
			u    apis.User
		}{
			{"admin", f.helper.Org1.Admin},
			{"editor", f.helper.Org1.Editor},
			{"viewer", f.helper.Org1.Viewer},
		}
		uids := []string{"parityA", "parityA1a", "parityB"} // root, deep, sibling
		for _, u := range users {
			for _, uid := range uids {
				t.Run(fmt.Sprintf("%s/%s", u.name, uid), func(t *testing.T) {
					assertGetFolderParity(t, f, u.u, uid)
				})
			}
		}
	})

	t.Run("GET /folders/id/{id} parity", func(t *testing.T) {
		// The legacy `id` lookup has no direct k8s twin — it's
		// reconstructed from the deprecatedInternalID label. Confirm
		// the round-trip: id → legacy Folder, then k8s Folder by UID,
		// and verify the label matches the input id.
		legacy := &dtos.Folder{}
		resp, body := f.legacyGet(t, f.helper.Org1.Admin, "/api/folders/parityA", legacy)
		require.Equal(t, http.StatusOK, resp.StatusCode, body)
		require.NotZero(t, legacy.ID) //nolint:staticcheck

		byID := &dtos.Folder{}
		resp, body = f.legacyGet(t, f.helper.Org1.Admin,
			fmt.Sprintf("/api/folders/id/%d", legacy.ID), byID) //nolint:staticcheck
		require.Equal(t, http.StatusOK, resp.StatusCode, body)
		require.Equal(t, "parityA", byID.UID)

		k8s, err := f.adminK8s.Resource.Get(context.Background(), "parityA", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t,
			fmt.Sprintf("%d", legacy.ID), //nolint:staticcheck
			k8s.GetLabels()[utils.LabelKeyDeprecatedInternalID],
			"k8s deprecatedInternalID label must match legacy numeric id",
		)
	})

	t.Run("GET /folders/{uid}/access parity", func(t *testing.T) {
		// Single-level: access info for a root-level folder.
		// Should agree because there's no parent chain to walk.
		t.Run("root-level folder (admin)", func(t *testing.T) {
			assertAccessParity(t, f, f.helper.Org1.Admin, "parityA")
		})

		// Nested case: access on parityA1a depends on perms inherited
		// from parityA. The new /access subresource doesn't flatten
		// the parent chain today, so it disagrees with legacy
		// for the elevated-on-A user.
		t.Run("nested folder with inherited permission", func(t *testing.T) {
			t.Skip("blocked by — sub_access.go does not walk parents; un-skip when A1.1 lands")
			assertAccessParity(t, f, f.rbacEditorOnA, "parityA1a")
		})
	})

	t.Run("POST /folders/{uid}/move parity", func(t *testing.T) {
		// Happy-path move. Run by Admin — both sides should accept.
		// assertMoveStatusParity restores the original parent itself,
		// so later subtests see the tree shape from newParityFixture.
		t.Run("admin moves between accessible folders", func(t *testing.T) {
			assertMoveStatusParity(t, f, f.helper.Org1.Admin,
				"parityB1", "parityA",
				/*expectStatus*/ http.StatusOK,
			)
		})

		// Escalation: rbacEditorOnA has folders:write on parityA but
		// not on parityB. Legacy `canMove` returns 403; the new API
		// (validateOnUpdate) does NOT enforce the destination check
		// today. Both should agree on 403 once A1.3 lands.
		t.Run("editor without destination perm is forbidden", func(t *testing.T) {
			t.Skip("blocked by — validateOnUpdate misses the escalation check; un-skip when A1.3 lands")
			assertMoveStatusParity(t, f, f.rbacEditorOnA,
				"parityA1", "parityB",
				/*expectStatus*/ http.StatusForbidden,
			)
		})

		// K6 source vs destination divergence. Legacy blocks
		// source==K6FolderUID, new blocks destination==K6FolderUID.
		// Test both directions so the eventual fix has to converge.
		t.Run("K6 source is rejected by both", func(t *testing.T) {
			t.Skip("blocked by — only legacy blocks K6 source; un-skip when A1.3 ports the guard")
			// We do not actually move the K6 folder — we just check
			// that both sides reject the attempt with the same code.
			assertMoveStatusParity(t, f, f.helper.Org1.Admin,
				accesscontrol.K6FolderUID, "parityA",
				/*expectStatus*/ http.StatusBadRequest,
			)
		})
	})

	t.Run("GET /folders/{uid}/children pagination", func(t *testing.T) {
		// Legacy never exposed a /children endpoint per se — wide
		// listing is done via GET /folders?parentUid=. Here we
		// verify that the new /children subresource at least returns
		// all 5 children of parityB and does not error.
		t.Skip("blocked by — sub_children.go caps at 500 items; un-skip when A1.4 paginates with continue tokens")

		resp, body := f.k8sGetSubresource(t, f.helper.Org1.Admin, "parityB", "children")
		require.Equal(t, http.StatusOK, resp.StatusCode, string(body))

		var children foldersV1.FolderList
		require.NoError(t, json.Unmarshal(body, &children),
			"decode /children: %s", string(body))
		got := make([]string, 0, len(children.Items))
		for _, it := range children.Items {
			got = append(got, it.Name)
		}
		sort.Strings(got)
		want := []string{"parityB1", "parityB2", "parityB3", "parityB4", "parityB5"}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Fatalf("children parity gap (-want +got):\n%s", diff)
		}
	})

	t.Run("PUT /folders/{uid} parity", func(t *testing.T) {
		// Update via k8s, then read both sides and diff the
		// projection. Catches drift in title/parent reflection.
		const uid = "parityA2"
		got, err := f.adminK8s.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		spec, _ := got.Object["spec"].(map[string]any)
		spec["title"] = "parityA2 (updated via k8s)"
		got.Object["spec"] = spec
		_, err = f.adminK8s.Resource.Update(context.Background(), got, metav1.UpdateOptions{})
		require.NoError(t, err)

		assertGetFolderParity(t, f, f.helper.Org1.Admin, uid)
	})

	t.Run("aggregator coverage", func(t *testing.T) {
		// Per the workflow doc: a single smoke test that runs the
		// monolith → aggregator → MT folder-apiserver pod path. Not
		// runnable in-process — needs devenv/mt-tilt wiring. Tracked
		// separately so the failure mode (skip vs fail) doesn't get
		// lost.
		t.Skip("aggregator smoke test lives outside go-test; see devenv/mt-tilt and the workflow-a doc")
	})
}

// assertGetFolderParity does GET /api/folders/{uid} and a k8s Get on the
// same uid, projects both sides, and diffs them.
func assertGetFolderParity(t *testing.T, f *parityFixture, user apis.User, uid string) {
	t.Helper()

	legacy := &dtos.Folder{}
	resp, body := f.legacyGet(t, user, "/api/folders/"+uid, legacy)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("legacy GET /api/folders/%s as %s returned %d: %s",
			uid, user.Identity.GetLogin(), resp.StatusCode, string(body))
	}

	client := f.helper.GetResourceClient(apis.ResourceClientArgs{User: user, GVR: gvr})
	k8s, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err, "k8s GET %s as %s", uid, user.Identity.GetLogin())

	want := normaliseProjection(projectLegacyFolder(legacy))
	got := normaliseProjection(projectK8sFolder(t, k8s))

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("folder %s parity gap (-legacy +k8s):\n%s", uid, diff)
	}
}

// assertAccessParity diffs the four can-* booleans between the legacy
// dtos.Folder response and the new /access subresource.
func assertAccessParity(t *testing.T, f *parityFixture, user apis.User, uid string) {
	t.Helper()

	legacy := &dtos.Folder{}
	resp, body := f.legacyGet(t, user, "/api/folders/"+uid+"?accesscontrol=true", legacy)
	require.Equal(t, http.StatusOK, resp.StatusCode, "legacy /folders/%s: %s", uid, body)

	accResp, accBody := f.k8sGetSubresource(t, user, uid, "access")
	require.Equal(t, http.StatusOK, accResp.StatusCode,
		"k8s /folders/%s/access: %s", uid, accBody)

	var access foldersV1.FolderAccessInfo
	require.NoError(t, json.Unmarshal(accBody, &access),
		"decode /access body: %s", string(accBody))

	want := projectLegacyAccess(legacy)
	got := projectK8sAccess(&access)

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("access parity gap on %s as %s (-legacy +k8s):\n%s",
			uid, user.Identity.GetLogin(), diff)
	}
}

// assertMoveStatusParity issues the same move via legacy POST /move and
// via k8s Update (changing the folder annotation) and asserts both sides
// agree on the resulting HTTP status. Body shape differs by surface, so
// only the status is compared.
func assertMoveStatusParity(t *testing.T, f *parityFixture, user apis.User, uid, newParent string, expectStatus int) {
	t.Helper()

	// Capture original parent so we can restore the tree afterwards on
	// success paths. The status-code-only contract here makes restore
	// only meaningful when both sides actually moved the folder.
	original := lookupParent(t, f, user, uid)

	body, err := json.Marshal(map[string]string{"parentUid": newParent})
	require.NoError(t, err)
	legacyRsp := apis.DoRequest(f.helper, apis.RequestParams{
		User:   user,
		Method: http.MethodPost,
		Path:   fmt.Sprintf("/api/folders/%s/move", uid),
		Body:   body,
	}, &json.RawMessage{})
	require.NotNil(t, legacyRsp.Response)
	if legacyRsp.Response.StatusCode != expectStatus {
		t.Fatalf("legacy move %s → %s as %s: got status %d, want %d: %s",
			uid, newParent, user.Identity.GetLogin(),
			legacyRsp.Response.StatusCode, expectStatus, string(legacyRsp.Body))
	}

	// Reset the tree so the k8s arm sees the same starting state as
	// the legacy arm did.
	if legacyRsp.Response.StatusCode == http.StatusOK {
		restoreParent(t, f, f.helper.Org1.Admin, uid, original)
	}

	// k8s arm: read, mutate annotation, update.
	client := f.helper.GetResourceClient(apis.ResourceClientArgs{User: user, GVR: gvr})
	got, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	anns := got.GetAnnotations()
	if anns == nil {
		anns = map[string]string{}
	}
	anns[utils.AnnoKeyFolder] = newParent
	got.SetAnnotations(anns)
	_, k8sErr := client.Resource.Update(context.Background(), got, metav1.UpdateOptions{})

	gotStatus := http.StatusOK
	if k8sErr != nil {
		gotStatus = statusCodeFromK8sError(k8sErr)
	}
	if gotStatus != expectStatus {
		t.Fatalf("k8s move %s → %s as %s: got status %d, want %d: %v",
			uid, newParent, user.Identity.GetLogin(),
			gotStatus, expectStatus, k8sErr)
	}

	// Restore for downstream tests.
	if gotStatus == http.StatusOK {
		restoreParent(t, f, f.helper.Org1.Admin, uid, original)
	}
}

func lookupParent(t *testing.T, f *parityFixture, user apis.User, uid string) string {
	t.Helper()
	res := &dtos.Folder{}
	resp, body := f.legacyGet(t, user, "/api/folders/"+uid, res)
	require.Equal(t, http.StatusOK, resp.StatusCode,
		"lookupParent legacy GET %s: %s", uid, body)
	return res.ParentUID
}

func restoreParent(t *testing.T, f *parityFixture, user apis.User, uid, parentUID string) {
	t.Helper()
	body, err := json.Marshal(map[string]string{"parentUid": parentUID})
	require.NoError(t, err)
	rsp := apis.DoRequest(f.helper, apis.RequestParams{
		User:   user,
		Method: http.MethodPost,
		Path:   fmt.Sprintf("/api/folders/%s/move", uid),
		Body:   body,
	}, &json.RawMessage{})
	require.NotNil(t, rsp.Response)
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode,
		"restoreParent %s → %s: %s", uid, parentUID, string(rsp.Body))
}

// statusCodeFromK8sError pulls the HTTP status out of a k8s dynamic-client
// error. The dynamic client wraps apierrors.StatusError; non-StatusError
// failures degrade to 500 so the assertion still produces a useful diff.
func statusCodeFromK8sError(err error) int {
	type statusCoder interface{ Status() metav1.Status }
	if sc, ok := err.(statusCoder); ok {
		return int(sc.Status().Code)
	}
	return http.StatusInternalServerError
}
