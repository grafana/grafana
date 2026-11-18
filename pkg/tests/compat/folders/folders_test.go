// Package folders checks that a folder tree survives a round trip between Grafana
// versions: nesting, moves through both the k8s and the legacy API, the parents,
// children, counts, access, and status subresources, folder permissions, list
// pagination and label selectors, and deleting a non-empty subtree.
package folders

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/compat"
)

func TestMain(m *testing.M) {
	compat.Main(m)
}

var (
	folderGR    = schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	dashboardGV = schema.GroupVersion{Group: "dashboard.grafana.app", Version: "v1"}
)

// Fixture names and values are a contract with older versions: they verify them as
// written here, so change or remove them only together with those versions.
//
// Setup creates:
//
//	parent-a
//	  child           (with a dashboard and a status)
//	    grandchild
//	  sibling
//	parent-b          (the viewer may edit it)
//	page-1..3         (labeled)
//
// Update moves child (through the k8s API) and sibling (through the legacy API) to
// parent-b, renames child, patches its status, and deletes page-3.
const (
	parentA      = "compat-folder-parent-a"
	parentB      = "compat-folder-parent-b"
	child        = "compat-folder-child"
	grandchild   = "compat-folder-grandchild"
	sibling      = "compat-folder-sibling"
	dashboard    = "compat-folder-dashboard"
	childTitle   = "Compat child"
	updatedTitle = "Compat child, updated by the other version"
	pageLabel    = "compat.grafana.app/page"
	deletedPage  = "compat-folder-page-3"
	// otherViewer may edit parent-a, the parent child and sibling move away from.
	otherViewer = "compat-folder-viewer"
)

// maxPages bounds the pagination loops, so a broken continue token fails instead of
// running until the test timeout. The fixtures need at most five pages.
const maxPages = 20

var (
	pages  = []string{"compat-folder-page-1", "compat-folder-page-2", deletedPage}
	titles = map[string]string{
		parentA:    "Compat parent A",
		parentB:    "Compat parent B",
		grandchild: "Compat grandchild",
		sibling:    "Compat sibling",
	}
)

// tree is the hierarchy the phases expect: before and after the update phase moves things.
type tree struct {
	name        string
	parent      string // parent of child and sibling
	otherParent string
	childTitle  string
	remaining   int64 // status.cascadeDelete.remaining of child
	// skipInherited is why inherited permissions cannot be checked yet, if they cannot.
	skipInherited string
}

var (
	beforeMove = tree{name: "before move", parent: parentA, otherParent: parentB, childTitle: childTitle, remaining: 2}
	afterMove  = tree{name: "after move", parent: parentB, otherParent: parentA, childTitle: updatedTitle, remaining: 1}
)

// TestCompatSetup creates the tree, a dashboard in child, a status on child, an extra
// permission on parent-b, and labeled folders for pagination and selectors.
func TestCompatSetup(t *testing.T) {
	h := compat.NewHelper(t)
	res := folderResource(t, h)
	folders := client(h, h.Org1.Admin, res.Versions[0])
	ctx := context.Background()

	create := func(name, title, parent string, labels map[string]string) {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": folderGR.WithVersion(res.Versions[0]).GroupVersion().String(),
			"kind":       "Folder",
			"metadata":   map[string]any{"name": name},
			"spec":       map[string]any{"title": title},
		}}
		if parent != "" {
			obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: parent})
		}
		obj.SetLabels(labels)
		_, err := folders.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err, name)
	}
	create(parentA, titles[parentA], "", nil)
	create(parentB, titles[parentB], "", nil)
	create(child, childTitle, parentA, nil)
	create(grandchild, titles[grandchild], child, nil)
	create(sibling, titles[sibling], parentA, nil)
	for i, name := range pages {
		create(name, fmt.Sprintf("Compat page %d", i+1), "", map[string]string{pageLabel: "true"})
	}

	_, err := dashboards(h).Create(ctx, &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": dashboardGV.String(),
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": dashboard, "annotations": map[string]any{utils.AnnoKeyFolder: child}},
		"spec":       map[string]any{"title": "Compat folder dashboard", "schemaVersion": 41},
	}}, metav1.CreateOptions{})
	require.NoError(t, err)

	status := `{"status":{"cascadeDelete":{"state":"InProgress","total":3,"remaining":2}}}`
	_, err = folders.Patch(ctx, child, types.MergePatchType, []byte(status), metav1.PatchOptions{}, "status")
	require.NoError(t, err)

	request(t, h, http.MethodPost, "/api/access-control/folders/"+parentB+"/users/"+h.Org1.Viewer.Identity.GetIdentifier(), `{"permission":"Edit"}`)
	request(t, h, http.MethodPost, "/api/access-control/folders/"+parentA+"/users/"+viewerOfParentA(h).Identity.GetIdentifier(), `{"permission":"Edit"}`)
}

// TestCompatUpdate runs on the other version: it checks the tree the setup version
// wrote, then moves, renames, patches, and deletes, and checks the result.
func TestCompatUpdate(t *testing.T) {
	h := compat.NewHelper(t)
	res := folderResource(t, h)
	folders := client(h, h.Org1.Admin, res.Versions[0])
	ctx := context.Background()

	checkTree(t, h, res, beforeMove)
	checkList(t, folders, allFolders(pages))

	// A status write must not touch the spec.
	patch := `{"spec":{"title":"Patched via status"},"status":{"cascadeDelete":{"remaining":1}}}`
	_, err := folders.Patch(ctx, child, types.MergePatchType, []byte(patch), metav1.PatchOptions{}, "status")
	require.NoError(t, err)

	// Move child with an ordinary update, which must keep its status, and sibling
	// through the legacy API.
	obj, err := folders.Get(ctx, child, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, childTitle, title(t, obj), "a status write changed the spec")
	require.NoError(t, unstructured.SetNestedField(obj.Object, updatedTitle, "spec", "title"))
	annotations := obj.GetAnnotations()
	annotations[utils.AnnoKeyFolder] = parentB
	obj.SetAnnotations(annotations)
	_, err = folders.Update(ctx, obj, metav1.UpdateOptions{})
	require.NoError(t, err)

	request(t, h, http.MethodPost, "/api/folders/"+sibling+"/move", `{"parentUid":"`+parentB+`"}`)
	require.NoError(t, folders.Delete(ctx, deletedPage, metav1.DeleteOptions{}))

	moved := afterMove
	moved.skipInherited = "the process that moved the folders caches their old ancestors for [authorization] cache_ttl; verify checks them in a new process"
	checkTree(t, h, res, moved)
}

// TestCompatVerify runs on the setup version again: it sees the other version's
// changes, deletes the moved subtree through the legacy API, and then the rest.
func TestCompatVerify(t *testing.T) {
	h := compat.NewHelper(t)
	res := folderResource(t, h)
	folders := client(h, h.Org1.Admin, res.Versions[0])
	ctx := context.Background()

	checkTree(t, h, res, afterMove)
	_, err := folders.Get(ctx, deletedPage, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "page deleted by the other version: expected not found, got %v", err)
	checkList(t, folders, allFolders(pages[:2]))

	// A plain delete must refuse a folder that still has a subfolder and a dashboard, also
	// when the other version moved it.
	err = folders.Delete(ctx, child, metav1.DeleteOptions{})
	require.True(t, apierrors.IsBadRequest(err), "deleting a non-empty folder: expected a bad request, got %v", err)
	for _, name := range []string{child, grandchild} {
		_, err := folders.Get(ctx, name, metav1.GetOptions{})
		require.NoError(t, err, "%s after a refused delete", name)
	}
	_, err = dashboards(h).Get(ctx, dashboard, metav1.GetOptions{})
	require.NoError(t, err, "dashboard after a refused delete of its folder")

	// Deleting a non-empty folder through the legacy API removes its whole subtree,
	// including the dashboard, and nothing else.
	request(t, h, http.MethodDelete, "/api/folders/"+parentB, "")
	for _, name := range []string{parentB, child, grandchild, sibling} {
		_, err := folders.Get(ctx, name, metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "%s after deleting its subtree: expected not found, got %v", name, err)
	}
	_, err = dashboards(h).Get(ctx, dashboard, metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "dashboard after deleting its folder: expected not found, got %v", err)
	checkList(t, folders, append([]string{parentA}, pages[:2]...))

	for _, name := range append([]string{parentA}, pages[:2]...) {
		require.NoError(t, folders.Delete(ctx, name, metav1.DeleteOptions{}), name)
	}
	list, err := folders.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, list.Items)
}

// checkTree checks the hierarchy through every served version, the subresources in the
// preferred version, and the legacy API.
func checkTree(t *testing.T, h *apis.K8sTestHelper, res compat.Resource, tr tree) {
	t.Helper()
	t.Run(tr.name, func(t *testing.T) {
		checkHierarchy(t, h, res, tr)
		v := res.Versions[0]
		for _, c := range []struct {
			subresource string
			check       func(*testing.T, *apis.K8sTestHelper, string, tree)
		}{
			{"parents", checkParents},
			{"children", checkChildren},
			{"counts", checkCounts},
			{"access", checkAccess},
			{"status", checkStatus},
		} {
			t.Run(c.subresource, func(t *testing.T) { c.check(t, h, v, tr) })
		}
		t.Run("legacy", func(t *testing.T) { checkLegacy(t, h, tr) })
	})
}

// checkHierarchy reads every folder of the tree in every served version.
func checkHierarchy(t *testing.T, h *apis.K8sTestHelper, res compat.Resource, tr tree) {
	t.Helper()
	ctx := context.Background()
	want := map[string]struct{ parent, title string }{
		parentA:    {"", titles[parentA]},
		parentB:    {"", titles[parentB]},
		child:      {tr.parent, tr.childTitle},
		grandchild: {child, titles[grandchild]},
		sibling:    {tr.parent, titles[sibling]},
	}
	for _, v := range res.Versions {
		folders := client(h, h.Org1.Admin, v)
		for name, w := range want {
			obj, err := folders.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err, "%s in %s", name, v)
			require.Equal(t, w.title, title(t, obj), "%s in %s", name, v)
			require.Equal(t, w.parent, obj.GetAnnotations()[utils.AnnoKeyFolder], "parent of %s in %s", name, v)
		}
	}
}

type folderInfoList struct {
	Items []struct {
		Name  string `json:"name"`
		Title string `json:"title"`
	} `json:"items"`
}

func checkParents(t *testing.T, h *apis.K8sTestHelper, v string, tr tree) {
	var parents folderInfoList
	getJSON(t, h, h.Org1.Admin, subresourcePath(h, v, grandchild, "parents"), &parents)
	got := make([]string, 0, len(parents.Items))
	for _, p := range parents.Items {
		got = append(got, p.Name+"="+p.Title)
	}
	require.Equal(t, []string{
		tr.parent + "=" + titles[tr.parent],
		child + "=" + tr.childTitle,
		grandchild + "=" + titles[grandchild],
	}, got, "ancestors root first, ending with the folder itself")
}

type childrenPage struct {
	Metadata struct {
		Continue string `json:"continue"`
	} `json:"metadata"`
	Items []struct {
		Metadata struct {
			Name string `json:"name"`
		} `json:"metadata"`
	} `json:"items"`
}

func checkChildren(t *testing.T, h *apis.K8sTestHelper, v string, tr tree) {
	children := func(name string, limit int) []string {
		var names []string
		next := ""
		for pages := 0; ; pages++ {
			require.Less(t, pages, maxPages, "children of %s: the continue token never ran out", name)
			var page childrenPage
			getJSON(t, h, h.Org1.Admin, subresourcePath(h, v, name, fmt.Sprintf("children?limit=%d&continue=%s", limit, next)), &page)
			require.LessOrEqual(t, len(page.Items), limit)
			for _, item := range page.Items {
				names = append(names, item.Metadata.Name)
			}
			if page.Metadata.Continue == "" {
				return names
			}
			next = page.Metadata.Continue
		}
	}
	require.ElementsMatch(t, []string{child, sibling}, children(tr.parent, 1), "children of %s, one per page", tr.parent)
	require.Empty(t, children(tr.otherParent, 10), "children of %s", tr.otherParent)
	require.Equal(t, []string{grandchild}, children(child, 10))
}

type descendantCounts struct {
	Counts []struct {
		Group    string `json:"group"`
		Resource string `json:"resource"`
		Count    int64  `json:"count"`
	} `json:"counts"`
}

func checkCounts(t *testing.T, h *apis.K8sTestHelper, v string, tr tree) {
	count := func(name string, gr schema.GroupResource) int64 {
		var counts descendantCounts
		getJSON(t, h, h.Org1.Admin, subresourcePath(h, v, name, "counts"), &counts)
		for _, c := range counts.Counts {
			if c.Group == gr.Group && c.Resource == gr.Resource {
				return c.Count
			}
		}
		return 0
	}
	dashboardsGR := dashboardGV.WithResource("dashboards").GroupResource()
	require.EqualValues(t, 2, count(tr.parent, folderGR), "folders in %s", tr.parent)
	require.EqualValues(t, 0, count(tr.otherParent, folderGR), "folders in %s", tr.otherParent)
	require.EqualValues(t, 1, count(child, folderGR), "folders in child")
	require.EqualValues(t, 1, count(child, dashboardsGR), "dashboards in child")
}

type accessInfo struct {
	CanEdit  bool `json:"canEdit"`
	CanAdmin bool `json:"canAdmin"`
}

func checkAccess(t *testing.T, h *apis.K8sTestHelper, v string, tr tree) {
	type accessCase struct {
		who    string
		user   apis.User
		folder string
		want   accessInfo
	}
	cases := []accessCase{
		{"admin", h.Org1.Admin, parentB, accessInfo{CanEdit: true, CanAdmin: true}},
		{"editor", h.Org1.Editor, parentB, accessInfo{CanEdit: true}},
		{"viewer with an edit grant", h.Org1.Viewer, parentB, accessInfo{CanEdit: true}},
		{"viewer", h.Org1.Viewer, parentA, accessInfo{}},
		{"other viewer with an edit grant", viewerOfParentA(h), parentA, accessInfo{CanEdit: true}},
		{"other viewer", viewerOfParentA(h), parentB, accessInfo{}},
	}
	// Each viewer's grant is inherited by whatever sits below that parent, so a move that
	// keeps permissions of the old parent, or misses those of the new one, shows up here.
	if tr.skipInherited != "" {
		t.Logf("skipping inherited permissions: %s", tr.skipInherited)
	} else {
		for _, name := range []string{child, grandchild, sibling} {
			cases = append(cases,
				accessCase{"viewer, under " + tr.parent, h.Org1.Viewer, name, accessInfo{CanEdit: tr.parent == parentB}},
				accessCase{"other viewer, under " + tr.parent, viewerOfParentA(h), name, accessInfo{CanEdit: tr.parent == parentA}},
			)
		}
	}
	for _, c := range cases {
		var got accessInfo
		getJSON(t, h, c.user, subresourcePath(h, v, c.folder, "access"), &got)
		require.Equal(t, c.want, got, "access of %s to %s", c.who, c.folder)
	}
}

type folderStatus struct {
	Spec struct {
		Title string `json:"title"`
	} `json:"spec"`
	Status struct {
		CascadeDelete struct {
			State     string `json:"state"`
			Total     int64  `json:"total"`
			Remaining int64  `json:"remaining"`
		} `json:"cascadeDelete"`
	} `json:"status"`
}

func checkStatus(t *testing.T, h *apis.K8sTestHelper, v string, tr tree) {
	var got folderStatus
	getJSON(t, h, h.Org1.Admin, subresourcePath(h, v, child, "status"), &got)
	require.Equal(t, tr.childTitle, got.Spec.Title)
	require.Equal(t, "InProgress", got.Status.CascadeDelete.State)
	require.EqualValues(t, 3, got.Status.CascadeDelete.Total)
	require.Equal(t, tr.remaining, got.Status.CascadeDelete.Remaining)
}

type legacyFolder struct {
	ParentUID string `json:"parentUid"`
	Parents   []struct {
		UID string `json:"uid"`
	} `json:"parents"`
}

type legacyPermission struct {
	UserLogin  string `json:"userLogin"`
	Permission int    `json:"permission"`
}

// checkLegacy reads the moved folders and the viewer's grant through the legacy API.
func checkLegacy(t *testing.T, h *apis.K8sTestHelper, tr tree) {
	for _, name := range []string{child, sibling} {
		var f legacyFolder
		getJSON(t, h, h.Org1.Admin, "/api/folders/"+name, &f)
		require.Equal(t, tr.parent, f.ParentUID, "legacy parent of %s", name)
		require.Len(t, f.Parents, 1, "legacy ancestors of %s", name)
		require.Equal(t, tr.parent, f.Parents[0].UID, "legacy ancestors of %s", name)
	}

	var permissions []legacyPermission
	getJSON(t, h, h.Org1.Admin, "/api/folders/"+parentB+"/permissions", &permissions)
	edit := legacyPermission{UserLogin: h.Org1.Viewer.Identity.GetLogin(), Permission: 2}
	require.Contains(t, permissions, edit, "viewer's edit permission on %s", parentB)
}

// checkList pages through all folders two at a time and selects the labeled ones.
func checkList(t *testing.T, folders dynamic.ResourceInterface, want []string) {
	t.Helper()
	ctx := context.Background()

	var names []string
	opts := metav1.ListOptions{Limit: 2}
	for pages := 0; ; pages++ {
		require.Less(t, pages, maxPages, "folder list: the continue token never ran out")
		list, err := folders.List(ctx, opts)
		require.NoError(t, err)
		require.LessOrEqual(t, len(list.Items), 2)
		for _, item := range list.Items {
			names = append(names, item.GetName())
		}
		if list.GetContinue() == "" {
			break
		}
		opts.Continue = list.GetContinue()
	}
	require.ElementsMatch(t, want, names, "pages must contain every folder exactly once")

	selected, err := folders.List(ctx, metav1.ListOptions{LabelSelector: pageLabel + "=true"})
	require.NoError(t, err)
	selectedNames := make([]string, 0, len(selected.Items))
	for _, item := range selected.Items {
		selectedNames = append(selectedNames, item.GetName())
	}
	var wantPages []string
	for _, name := range want {
		if slices.Contains(pages, name) {
			wantPages = append(wantPages, name)
		}
	}
	require.ElementsMatch(t, wantPages, selectedNames)
}

// getJSON GETs path as user and decodes the JSON response into out.
func getJSON(t *testing.T, h *apis.K8sTestHelper, user apis.User, path string, out any) {
	t.Helper()
	rsp := apis.DoRequest(h, apis.RequestParams{User: user, Path: path}, &json.RawMessage{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "GET %s: %s", path, rsp.Body)
	require.NoError(t, json.Unmarshal(rsp.Body, out), "GET %s: %s", path, rsp.Body)
}

// request sends a legacy API request as the admin and requires a 200.
func request(t *testing.T, h *apis.K8sTestHelper, method, path, body string) {
	t.Helper()
	params := apis.RequestParams{User: h.Org1.Admin, Method: method, Path: path}
	if body != "" {
		params.Body = []byte(body)
	}
	rsp := apis.DoRequest(h, params, &json.RawMessage{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode, "%s %s: %s", method, path, rsp.Body)
}

func subresourcePath(h *apis.K8sTestHelper, version, name, subresource string) string {
	return fmt.Sprintf("/apis/%s/namespaces/%s/folders/%s/%s",
		folderGR.WithVersion(version).GroupVersion(), h.Namespacer(h.Org1.Admin.Identity.GetOrgID()), name, subresource)
}

func allFolders(pages []string) []string {
	return append([]string{parentA, parentB, child, grandchild, sibling}, pages...)
}

func folderResource(t *testing.T, h *apis.K8sTestHelper) compat.Resource {
	t.Helper()
	res, ok := compat.Served(t, h)[folderGR]
	require.True(t, ok, "folders are not served")
	return res
}

func client(h *apis.K8sTestHelper, user apis.User, version string) dynamic.ResourceInterface {
	return h.GetResourceClient(apis.ResourceClientArgs{User: user, GVR: folderGR.WithVersion(version)}).Resource
}

// viewerOfParentA returns the viewer with Edit on parent-a, creating it in the first phase
// and finding it again in the later ones.
func viewerOfParentA(h *apis.K8sTestHelper) apis.User {
	return h.CreateUser(otherViewer, apis.Org1, identity.RoleViewer, nil)
}

func dashboards(h *apis.K8sTestHelper) dynamic.ResourceInterface {
	return h.GetResourceClient(apis.ResourceClientArgs{User: h.Org1.Admin, GVR: dashboardGV.WithResource("dashboards")}).Resource
}

func title(t *testing.T, obj *unstructured.Unstructured) string {
	t.Helper()
	v, _, err := unstructured.NestedString(obj.Object, "spec", "title")
	require.NoError(t, err)
	return v
}
