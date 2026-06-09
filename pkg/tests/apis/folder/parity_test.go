package folder

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

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
)

// Each subtest verifies that legacy /api/folders and the v1 k8s folders API
// return equivalent information or behaviour for the same input. Subtests
// marked (KNOWN GAP) are skipped with a note pointing to the work that will
// close the gap.
func TestIntegrationFolderAPIParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("only run on sqlite for now")
	}

	f := newParityFixture(t)

	t.Run("get folder", func(t *testing.T) {
		t.Run("admin reads root", func(t *testing.T) {
			assertGetFolderParity(t, f, f.helper.Org1.Admin, "parityA")
		})
		t.Run("admin reads nested", func(t *testing.T) {
			assertGetFolderParity(t, f, f.helper.Org1.Admin, "parityA1a")
		})
		t.Run("editor reads root", func(t *testing.T) {
			assertGetFolderParity(t, f, f.helper.Org1.Editor, "parityA")
		})
		t.Run("editor reads nested", func(t *testing.T) {
			assertGetFolderParity(t, f, f.helper.Org1.Editor, "parityA1a")
		})
		t.Run("viewer reads root", func(t *testing.T) {
			assertGetFolderParity(t, f, f.helper.Org1.Viewer, "parityA")
		})
		t.Run("viewer reads nested", func(t *testing.T) {
			assertGetFolderParity(t, f, f.helper.Org1.Viewer, "parityA1a")
		})
	})

	t.Run("legacy numeric id exposed as k8s label", func(t *testing.T) {
		assertNumericIDLabelParity(t, f, "parityA")
	})

	t.Run("get folder access", func(t *testing.T) {
		t.Run("admin on root", func(t *testing.T) {
			assertAccessParity(t, f, f.helper.Org1.Admin, "parityA")
		})
		t.Run("editor with inherited permission (KNOWN GAP)", func(t *testing.T) {
			t.Skip("sub_access.go does not walk parents; un-skip when fix lands")
			assertAccessParity(t, f, f.rbacEditorOnA, "parityA1a")
		})
	})

	t.Run("move folder", func(t *testing.T) {
		t.Run("admin to accessible parent", func(t *testing.T) {
			assertMoveParity(t, f, f.helper.Org1.Admin, "parityB1", "parityA", http.StatusOK)
		})
		t.Run("editor without dest permission is forbidden (KNOWN GAP)", func(t *testing.T) {
			t.Skip("validateOnUpdate misses the escalation check; un-skip when fix lands")
			assertMoveParity(t, f, f.rbacEditorOnA, "parityA1", "parityB", http.StatusForbidden)
		})
		t.Run("k6 source folder is rejected", func(t *testing.T) {
			assertK6SourceMoveParity(t, f, "parityA", http.StatusBadRequest)
		})
	})

	t.Run("list children (KNOWN GAP)", func(t *testing.T) {
		t.Skip("sub_children.go caps at 500 items; un-skip when fix lands")
		assertChildrenParity(t, f, f.helper.Org1.Admin, "parityB",
			[]string{"parityB1", "parityB2", "parityB3", "parityB4", "parityB5"})
	})

	t.Run("update folder", func(t *testing.T) {
		t.Run("k8s update reflects on legacy read", func(t *testing.T) {
			const uid = "parityA2"
			updateK8sTitle(t, f, uid, "parityA2 (updated via k8s)")
			assertGetFolderParity(t, f, f.helper.Org1.Admin, uid)
		})
	})
}

// parityFixture tree:
//
//	root
//	├── parityA
//	│   ├── parityA1
//	│   │   └── parityA1a
//	│   └── parityA2
//	└── parityB
//	    ├── parityB1 … parityB5
type parityFixture struct {
	helper        *apis.K8sTestHelper
	adminK8s      *apis.K8sResourceClient
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

	create := func(uid, parentUID string) {
		body, err := json.Marshal(map[string]string{
			"uid":       uid,
			"title":     uid,
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

	create("parityA", "")
	create("parityA1", "parityA")
	create("parityA1a", "parityA1")
	create("parityA2", "parityA")
	create("parityB", "")
	for i := 1; i <= 5; i++ {
		create(fmt.Sprintf("parityB%d", i), "parityB")
	}
	create(accesscontrol.K6FolderUID, "")

	rbacEditorOnA := helper.CreateUser(
		"parity-elevated-A", apis.Org1,
		org.RoleEditor,
		[]resourcepermissions.SetResourcePermissionCommand{{
			Actions:           []string{folder.ActionFoldersRead, folder.ActionFoldersWrite},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        "parityA",
		}},
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

func (f *parityFixture) legacyGet(t *testing.T, user apis.User, path string, out any) (int, []byte) {
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
	return rsp.Response.StatusCode, rsp.Body
}

func (f *parityFixture) k8sGetSubresource(t *testing.T, user apis.User, uid, sub string) (int, []byte) {
	t.Helper()
	path := fmt.Sprintf("/apis/%s/%s/namespaces/%s/folders/%s/%s",
		foldersV1.GROUP, foldersV1.VERSION, f.namespace(), uid, sub)
	rsp := apis.DoRequest(f.helper, apis.RequestParams{
		User:   user,
		Method: http.MethodGet,
		Path:   path,
	}, &json.RawMessage{})
	require.NotNil(t, rsp.Response, "k8s %s: nil response", path)
	return rsp.Response.StatusCode, rsp.Body
}

// ---------------------------------------------------------------------------
// Projections — minimal shapes compared across the two APIs.
// ---------------------------------------------------------------------------

type folderProjection struct {
	UID       string
	Title     string
	ParentUID string
}

func projectLegacyFolder(f *dtos.Folder) folderProjection {
	return folderProjection{
		UID:       f.UID,
		Title:     f.Title,
		ParentUID: f.ParentUID,
	}
}

func projectK8sFolder(u *unstructured.Unstructured) folderProjection {
	spec, _ := u.Object["spec"].(map[string]any)
	title, _ := spec["title"].(string)
	return folderProjection{
		UID:       u.GetName(),
		Title:     title,
		ParentUID: u.GetAnnotations()[utils.AnnoKeyFolder],
	}
}

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

// ---------------------------------------------------------------------------
// Assertions — each verifies one slice of parity between the two APIs.
// ---------------------------------------------------------------------------

func assertGetFolderParity(t *testing.T, f *parityFixture, user apis.User, uid string) {
	t.Helper()

	legacy := &dtos.Folder{}
	statuscode, body := f.legacyGet(t, user, "/api/folders/"+uid, legacy)
	require.Equal(t, http.StatusOK, statuscode,
		"legacy GET %s as %s: %s", uid, user.Identity.GetLogin(), body)

	client := f.helper.GetResourceClient(apis.ResourceClientArgs{User: user, GVR: gvr})
	k8s, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err, "k8s GET %s as %s", uid, user.Identity.GetLogin())

	want := projectLegacyFolder(legacy)
	got := projectK8sFolder(k8s)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("folder %s parity gap (-legacy +k8s):\n%s", uid, diff)
	}
}

func assertAccessParity(t *testing.T, f *parityFixture, user apis.User, uid string) {
	t.Helper()

	legacy := &dtos.Folder{}
	statuscode, body := f.legacyGet(t, user, "/api/folders/"+uid+"?accesscontrol=true", legacy)
	require.Equal(t, http.StatusOK, statuscode, "legacy /folders/%s: %s", uid, body)

	statuscode, body = f.k8sGetSubresource(t, user, uid, "access")
	require.Equal(t, http.StatusOK, statuscode, "k8s /folders/%s/access: %s", uid, body)

	var access foldersV1.FolderAccessInfo
	require.NoError(t, json.Unmarshal(body, &access), "decode /access body: %s", string(body))

	want := projectLegacyAccess(legacy)
	got := projectK8sAccess(&access)
	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("access parity gap on %s as %s (-legacy +k8s):\n%s",
			uid, user.Identity.GetLogin(), diff)
	}
}

func assertNumericIDLabelParity(t *testing.T, f *parityFixture, uid string) {
	t.Helper()

	legacy := &dtos.Folder{}
	statuscode, body := f.legacyGet(t, f.helper.Org1.Admin, "/api/folders/"+uid, legacy)
	require.Equal(t, http.StatusOK, statuscode, body)
	require.NotZero(t, legacy.ID) //nolint:staticcheck

	byID := &dtos.Folder{}
	statuscode, body = f.legacyGet(t, f.helper.Org1.Admin,
		fmt.Sprintf("/api/folders/id/%d", legacy.ID), byID) //nolint:staticcheck
	require.Equal(t, http.StatusOK, statuscode, body)
	require.Equal(t, uid, byID.UID, "legacy /folders/id/{id} should round-trip to the same uid")

	k8s, err := f.adminK8s.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t,
		fmt.Sprintf("%d", legacy.ID), //nolint:staticcheck
		k8s.GetLabels()[utils.LabelKeyDeprecatedInternalID],
		"k8s deprecatedInternalID label must match legacy numeric id",
	)
}

// assertMoveParity verifies legacy and k8s return the same HTTP status for
// the same move. On success it restores the original parent so the next
// assertion starts from the same state.
func assertMoveParity(t *testing.T, f *parityFixture, user apis.User, uid, newParent string, expectStatus int) {
	t.Helper()

	var original string
	if expectStatus == http.StatusOK {
		original = lookupParent(t, f, user, uid)
	}

	legacyStatus := legacyMove(t, f, user, uid, newParent)
	if legacyStatus != expectStatus {
		t.Fatalf("legacy move %s → %s as %s: got %d, want %d",
			uid, newParent, user.Identity.GetLogin(), legacyStatus, expectStatus)
	}
	if legacyStatus == http.StatusOK {
		restoreParent(t, f, f.helper.Org1.Admin, uid, original)
	}

	k8sStatus := k8sMove(t, f, user, uid, newParent)
	if k8sStatus != expectStatus {
		t.Fatalf("k8s move %s → %s as %s: got %d, want %d",
			uid, newParent, user.Identity.GetLogin(), k8sStatus, expectStatus)
	}
	if k8sStatus == http.StatusOK {
		restoreParent(t, f, f.helper.Org1.Admin, uid, original)
	}
}

// assertK6SourceMoveParity drives both APIs through the admin service-account
// token because k6-app is hidden from non-service-account identities.
func assertK6SourceMoveParity(t *testing.T, f *parityFixture, newParent string, expectStatus int) {
	t.Helper()

	saToken := f.helper.Org1.AdminServiceAccountToken
	require.NotEmpty(t, saToken)

	body, err := json.Marshal(map[string]string{"parentUid": newParent})
	require.NoError(t, err)
	rsp := apis.DoRequest(f.helper, apis.RequestParams{
		Method:  http.MethodPost,
		Path:    fmt.Sprintf("/api/folders/%s/move", accesscontrol.K6FolderUID),
		Body:    body,
		Headers: map[string]string{"Authorization": "Bearer " + saToken},
	}, &json.RawMessage{})
	require.NotNil(t, rsp.Response)
	require.Equal(t, expectStatus, rsp.Response.StatusCode,
		"legacy move k6-app → %s: body=%s", newParent, string(rsp.Body))

	client := f.helper.GetResourceClient(apis.ResourceClientArgs{
		ServiceAccountToken: saToken,
		Namespace:           f.namespace(),
		GVR:                 gvr,
	})
	got, err := client.Resource.Get(context.Background(), accesscontrol.K6FolderUID, metav1.GetOptions{})
	require.NoError(t, err)

	anns := got.GetAnnotations()
	if anns == nil {
		anns = map[string]string{}
	}
	anns[utils.AnnoKeyFolder] = newParent
	got.SetAnnotations(anns)

	_, err = client.Resource.Update(context.Background(), got, metav1.UpdateOptions{})
	require.Error(t, err)
	require.Equal(t, expectStatus, statusCodeFromK8sError(err))
}

func assertChildrenParity(t *testing.T, f *parityFixture, user apis.User, parentUID string, want []string) {
	t.Helper()

	statuscode, body := f.k8sGetSubresource(t, user, parentUID, "children")
	require.Equal(t, http.StatusOK, statuscode, string(body))

	var children foldersV1.FolderList
	require.NoError(t, json.Unmarshal(body, &children), "decode /children: %s", string(body))

	got := make([]string, 0, len(children.Items))
	for _, it := range children.Items {
		got = append(got, it.Name)
	}
	sort.Strings(got)

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("children parity gap (-want +got):\n%s", diff)
	}
}

// ---------------------------------------------------------------------------
// Move + update helpers — single-API actions used by the parity assertions.
// ---------------------------------------------------------------------------

func legacyMove(t *testing.T, f *parityFixture, user apis.User, uid, newParent string) int {
	t.Helper()
	body, err := json.Marshal(map[string]string{"parentUid": newParent})
	require.NoError(t, err)
	rsp := apis.DoRequest(f.helper, apis.RequestParams{
		User:   user,
		Method: http.MethodPost,
		Path:   fmt.Sprintf("/api/folders/%s/move", uid),
		Body:   body,
	}, &json.RawMessage{})
	require.NotNil(t, rsp.Response)
	return rsp.Response.StatusCode
}

func k8sMove(t *testing.T, f *parityFixture, user apis.User, uid, newParent string) int {
	t.Helper()
	client := f.helper.GetResourceClient(apis.ResourceClientArgs{User: user, GVR: gvr})
	got, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	if err != nil {
		return statusCodeFromK8sError(err)
	}

	anns := got.GetAnnotations()
	if anns == nil {
		anns = map[string]string{}
	}
	anns[utils.AnnoKeyFolder] = newParent
	got.SetAnnotations(anns)

	if _, err := client.Resource.Update(context.Background(), got, metav1.UpdateOptions{}); err != nil {
		return statusCodeFromK8sError(err)
	}
	return http.StatusOK
}

func lookupParent(t *testing.T, f *parityFixture, user apis.User, uid string) string {
	t.Helper()
	res := &dtos.Folder{}
	statuscode, body := f.legacyGet(t, user, "/api/folders/"+uid, res)
	require.Equal(t, http.StatusOK, statuscode, "lookupParent %s: %s", uid, body)
	return res.ParentUID
}

func restoreParent(t *testing.T, f *parityFixture, user apis.User, uid, parentUID string) {
	t.Helper()
	status := legacyMove(t, f, user, uid, parentUID)
	require.Equal(t, http.StatusOK, status,
		"restoreParent %s → %s returned %d", uid, parentUID, status)
}

func updateK8sTitle(t *testing.T, f *parityFixture, uid, title string) {
	t.Helper()
	got, err := f.adminK8s.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	spec, _ := got.Object["spec"].(map[string]any)
	spec["title"] = title
	got.Object["spec"] = spec
	_, err = f.adminK8s.Resource.Update(context.Background(), got, metav1.UpdateOptions{})
	require.NoError(t, err)
}

func statusCodeFromK8sError(err error) int {
	type statusCoder interface{ Status() metav1.Status }
	if sc, ok := err.(statusCoder); ok {
		return int(sc.Status().Code)
	}
	return http.StatusInternalServerError
}
