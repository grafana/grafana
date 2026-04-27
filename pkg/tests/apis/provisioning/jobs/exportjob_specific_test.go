package jobs

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ExportSpecificResources verifies the selective
// export path: when Push.Resources names specific dashboards, only those
// dashboards are written to the repository and unrelated dashboards stay out
// of the exported tree.
func TestIntegrationProvisioning_ExportSpecificResources(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Five dashboards across every supported version; v0, v1, v2, v2beta1 are
	// named in Resources and expected to land in the repo, v2alpha1 is left
	// out to prove non-selected dashboards stay excluded.
	v0Dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v0.yaml")
	_, err := helper.DashboardsV0.Resource.Create(ctx, v0Dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v0 dashboard")

	v1Dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err = helper.DashboardsV1.Resource.Create(ctx, v1Dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	v2Dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2.yaml")
	_, err = helper.DashboardsV2.Resource.Create(ctx, v2Dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2 dashboard")

	v2alphaDash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2alpha1.yaml")
	_, err = helper.DashboardsV2alpha1.Resource.Create(ctx, v2alphaDash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2alpha1 dashboard")

	v2betaDash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	_, err = helper.DashboardsV2beta1.Resource.Create(ctx, v2betaDash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2beta1 dashboard")

	const repo = "selective-export-repo"
	testRepo := common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 5,
		ExpectedFolders:    0,
	}
	helper.CreateLocalRepo(t, testRepo)

	helper.DebugState(t, repo, "BEFORE SELECTIVE EXPORT")

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Path: "",
			Resources: []provisioning.ResourceRef{
				{Name: "test-v0", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				{Name: "test-v1", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				{Name: "test-v2", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				{Name: "test-v2beta1", Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	helper.DebugState(t, repo, "AFTER SELECTIVE EXPORT")
	common.PrintFileTree(t, helper.ProvisioningPath)

	// Named dashboards should be written, each with its stored apiVersion
	// and a regenerated metadata.name (standalone export uses new UIDs).
	type expected struct {
		title      string
		origName   string
		apiVersion string
		fileName   string
	}
	for _, tt := range []expected{
		{title: "Test dashboard. Created at v0", origName: "test-v0", apiVersion: "dashboard.grafana.app/v0alpha1", fileName: "test-dashboard-created-at-v0.json"},
		{title: "Test dashboard. Created at v1", origName: "test-v1", apiVersion: "dashboard.grafana.app/v1", fileName: "test-dashboard-created-at-v1.json"},
		{title: "Test dashboard. Created at v2", origName: "test-v2", apiVersion: "dashboard.grafana.app/v2", fileName: "test-dashboard-created-at-v2.json"},
		{title: "Test dashboard. Created at v2beta1", origName: "test-v2beta1", apiVersion: "dashboard.grafana.app/v2beta1", fileName: "test-dashboard-created-at-v2beta1.json"},
	} {
		fpath := filepath.Join(helper.ProvisioningPath, tt.fileName)
		//nolint:gosec // reading known test output path
		body, err := os.ReadFile(fpath)
		require.NoError(t, err, "selectively-exported file missing at %s", fpath)

		obj := map[string]any{}
		require.NoError(t, json.Unmarshal(body, &obj), "exported file not json %s", fpath)

		val, _, err := unstructured.NestedString(obj, "apiVersion")
		require.NoError(t, err)
		require.Equal(t, tt.apiVersion, val)

		val, _, err = unstructured.NestedString(obj, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, tt.title, val)

		val, _, err = unstructured.NestedString(obj, "metadata", "name")
		require.NoError(t, err)
		require.NotEmpty(t, val)
		require.NotEqual(t, tt.origName, val, "standalone export should regenerate UID")
	}

	// The v2alpha1 dashboard was NOT named in Resources; its file must not exist.
	excluded := filepath.Join(helper.ProvisioningPath, "test-dashboard-created-at-v2alpha1.json")
	_, err = os.Stat(excluded)
	require.True(t, os.IsNotExist(err), "non-selected dashboard file should not be written: %s", excluded)
}

// TestIntegrationProvisioning_ExportSpecificResources_NotFound verifies that
// naming a dashboard that does not exist finishes the job in error state
// with a "not found" error recorded against that resource. The caller asked
// for something that cannot be exported, so the job surfaces the failure
// rather than silently dropping the reference.
func TestIntegrationProvisioning_ExportSpecificResources_NotFound(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// A real dashboard exists alongside the missing ref so we can assert the
	// partial-write behavior: present ones are still written even though the
	// job ends in error because of the missing sibling.
	v1Dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err := helper.DashboardsV1.Resource.Create(ctx, v1Dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	const repo = "selective-export-notfound-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 1,
		ExpectedFolders:    0,
	})

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: "test-v1", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				{Name: "does-not-exist", Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		},
	}

	job := helper.TriggerJobAndWaitForComplete(t, repo, spec)

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Equal(t, provisioning.JobStateError, jobObj.Status.State,
		"missing explicitly-requested resource should fail the job")

	foundError := false
	for _, e := range jobObj.Status.Errors {
		if strings.Contains(e, "does-not-exist") {
			foundError = true
			break
		}
	}
	require.True(t, foundError,
		"expected an error mentioning the missing resource; got: %v", jobObj.Status.Errors)

	// The present dashboard should still have been exported.
	present := filepath.Join(helper.ProvisioningPath, "test-dashboard-created-at-v1.json")
	_, err = os.Stat(present)
	require.NoError(t, err, "present dashboard should still be exported despite sibling being missing")
}

// TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive verifies
// the folder-recursive export path: when Push.Resources names a Folder, the
// folder itself, every descendant folder, and every dashboard inside the
// subtree is written to the repository — while a sibling folder's dashboard
// stays out of the export.
//
// Hierarchy under test:
//
//	parent/  (requested)
//	 ├─ child/
//	 │   ├─ grandchild/
//	 │   │   └─ dash-in-grandchild
//	 │   └─ dash-in-child
//	 └─ dash-in-parent
//	sibling/  (NOT requested)
//	 └─ dash-in-sibling
func TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	parent := makeFolder(t, helper, ctx, "parent-title", "")
	child := makeFolder(t, helper, ctx, "child-title", parent.GetName())
	grandchild := makeFolder(t, helper, ctx, "grandchild-title", child.GetName())
	sibling := makeFolder(t, helper, ctx, "sibling-title", "")

	makeDashboardInFolder(t, helper, ctx, "Dash in parent", parent.GetName())
	makeDashboardInFolder(t, helper, ctx, "Dash in child", child.GetName())
	makeDashboardInFolder(t, helper, ctx, "Dash in grandchild", grandchild.GetName())
	makeDashboardInFolder(t, helper, ctx, "Dash in sibling", sibling.GetName())

	const repo = "selective-export-folder-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 4,
		ExpectedFolders:    4,
	})

	helper.DebugState(t, repo, "BEFORE FOLDER-RECURSIVE EXPORT")

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: parent.GetName(), Kind: "Folder", Group: "folder.grafana.app"},
			},
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	helper.DebugState(t, repo, "AFTER FOLDER-RECURSIVE EXPORT")
	common.PrintFileTree(t, helper.ProvisioningPath)

	// Selective export materializes only the requested folder + its descendants
	// (the requested folder is at the namespace root here, so no extra
	// ancestor chain). Unrelated folders such as `sibling` must NOT be
	// emitted to the repository.
	require.DirExists(t, filepath.Join(helper.ProvisioningPath, "parent-title"),
		"requested folder directory should exist")
	require.DirExists(t, filepath.Join(helper.ProvisioningPath, "parent-title", "child-title"),
		"descendant folder directory should exist")
	require.DirExists(t, filepath.Join(helper.ProvisioningPath, "parent-title", "child-title", "grandchild-title"),
		"deeply-nested descendant folder directory should exist")

	siblingDir := filepath.Join(helper.ProvisioningPath, "sibling-title")
	_, err := os.Stat(siblingDir)
	require.True(t, os.IsNotExist(err),
		"sibling folder directory must NOT be materialized when not requested: %s", siblingDir)

	// Subtree dashboards land in their natural subdirectories.
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "parent-title", "dash-in-parent.json"),
		"dashboard in requested folder should be exported")
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "parent-title", "child-title", "dash-in-child.json"),
		"dashboard in descendant folder should be exported recursively")
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "parent-title", "child-title", "grandchild-title", "dash-in-grandchild.json"),
		"dashboard in deeply-nested descendant folder should be exported recursively")

	// The sibling dashboard sits outside the requested subtree and must be
	// excluded along with its parent folder dir.
	siblingDash := filepath.Join(siblingDir, "dash-in-sibling.json")
	_, err = os.Stat(siblingDash)
	require.True(t, os.IsNotExist(err),
		"dashboard outside the requested subtree should not be exported: %s", siblingDash)
}

// TestIntegrationProvisioning_ExportSpecificResources_DashboardRefMaterializesAncestorsOnly
// pins the scoped behavior for dashboard refs: when a Dashboard ref lives
// deep in a hierarchy, only its ancestor folder chain is materialized in the
// repository. An unrelated sibling folder must NOT have its directory created.
func TestIntegrationProvisioning_ExportSpecificResources_DashboardRefMaterializesAncestorsOnly(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Hierarchy:
	//   parent/   <- ancestor of requested dash (must be materialized)
	//     child/  <- direct parent of requested dash (must be materialized)
	//       target-dash  <- the one we ask for
	//   sibling/  <- unrelated; must NOT appear in the repo
	//     sibling-dash  <- unrelated; must NOT appear in the repo
	parent := makeFolder(t, helper, ctx, "anc-parent", "")
	child := makeFolder(t, helper, ctx, "anc-child", parent.GetName())
	sibling := makeFolder(t, helper, ctx, "anc-sibling", "")

	target := makeDashboardInFolder(t, helper, ctx, "Target dash", child.GetName())
	makeDashboardInFolder(t, helper, ctx, "Sibling dash", sibling.GetName())

	const repo = "selective-export-dash-ancestors-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 2,
		ExpectedFolders:    3,
	})

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: target.GetName(), Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	// Ancestor chain materialized so the dashboard's natural path resolves.
	require.DirExists(t, filepath.Join(helper.ProvisioningPath, "anc-parent"),
		"ancestor folder directory should be materialized")
	require.DirExists(t, filepath.Join(helper.ProvisioningPath, "anc-parent", "anc-child"),
		"immediate parent folder directory should be materialized")
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "anc-parent", "anc-child", "target-dash.json"),
		"requested dashboard should land at its natural ancestor-rooted path")

	// Sibling folder is unrelated to the requested dashboard — nothing about
	// it should appear in the repository.
	siblingDir := filepath.Join(helper.ProvisioningPath, "anc-sibling")
	_, err := os.Stat(siblingDir)
	require.True(t, os.IsNotExist(err),
		"unrelated sibling folder directory must NOT be materialized: %s", siblingDir)
}

// TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive_MultipleRoots
// pins the multi-root behavior: naming two unrelated folders in the same
// request exports both subtrees and leaves a third unrelated folder's
// dashboards out.
func TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive_MultipleRoots(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	teamA := makeFolder(t, helper, ctx, "team-a", "")
	teamB := makeFolder(t, helper, ctx, "team-b", "")
	teamC := makeFolder(t, helper, ctx, "team-c", "")

	makeDashboardInFolder(t, helper, ctx, "Dash team a", teamA.GetName())
	makeDashboardInFolder(t, helper, ctx, "Dash team b", teamB.GetName())
	makeDashboardInFolder(t, helper, ctx, "Dash team c", teamC.GetName())

	const repo = "selective-export-folder-multi-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 3,
		ExpectedFolders:    3,
	})

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: teamA.GetName(), Kind: "Folder", Group: "folder.grafana.app"},
				{Name: teamB.GetName(), Kind: "Folder", Group: "folder.grafana.app"},
			},
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "team-a", "dash-team-a.json"),
		"dashboard in first requested root should be exported")
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "team-b", "dash-team-b.json"),
		"dashboard in second requested root should be exported")

	excluded := filepath.Join(helper.ProvisioningPath, "team-c", "dash-team-c.json")
	_, err := os.Stat(excluded)
	require.True(t, os.IsNotExist(err),
		"dashboard in non-requested folder should not be exported: %s", excluded)
}

// TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive_NotFound
// asserts that naming a folder UID the API does not know about ends the job in
// error state with the missing UID surfaced in JobStatus.Errors. A real
// folder named alongside it still has its subtree exported — partial-write
// behavior matches the dashboard NotFound case.
func TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive_NotFound(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	real := makeFolder(t, helper, ctx, "real-folder", "")
	makeDashboardInFolder(t, helper, ctx, "Real dash", real.GetName())

	const repo = "selective-export-folder-notfound-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	})

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: real.GetName(), Kind: "Folder", Group: "folder.grafana.app"},
				{Name: "ghost-folder-uid", Kind: "Folder", Group: "folder.grafana.app"},
			},
		},
	}

	job := helper.TriggerJobAndWaitForComplete(t, repo, spec)

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	require.Equal(t, provisioning.JobStateError, jobObj.Status.State,
		"missing folder ref should escalate the job to error state")

	foundError := false
	for _, e := range jobObj.Status.Errors {
		if strings.Contains(e, "ghost-folder-uid") {
			foundError = true
			break
		}
	}
	require.True(t, foundError,
		"expected an error mentioning the missing folder UID; got: %v", jobObj.Status.Errors)

	// The real folder's dashboard should still be written despite the sibling
	// ref failing — the per-folder error is recorded and the rest of the
	// export proceeds.
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "real-folder", "real-dash.json"),
		"present folder's dashboard should still be exported despite a missing sibling ref")
}

// TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive_MixedWithDashboard
// pins the mixed-kind contract: a single request can name a Folder ref AND a
// standalone Dashboard ref; both paths run and each writes the expected files.
func TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive_MixedWithDashboard(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	folder := makeFolder(t, helper, ctx, "mix-folder", "")
	unrelated := makeFolder(t, helper, ctx, "unrelated-folder", "")

	makeDashboardInFolder(t, helper, ctx, "Dash in mix folder", folder.GetName())
	makeDashboardInFolder(t, helper, ctx, "Unrelated dash", unrelated.GetName())
	soloDash := makeDashboardInFolder(t, helper, ctx, "Solo dash", "")

	const repo = "selective-export-folder-mixed-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 3,
		ExpectedFolders:    2,
	})

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: folder.GetName(), Kind: "Folder", Group: "folder.grafana.app"},
				{Name: soloDash.GetName(), Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	// Folder ref expanded to its dashboard.
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "mix-folder", "dash-in-mix-folder.json"),
		"dashboard inside the requested folder should be exported")
	// Standalone Dashboard ref.
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "solo-dash.json"),
		"standalone dashboard ref should be exported at the repo root")

	// Unrelated folder's dashboard was neither named nor inside a requested
	// subtree — must be excluded.
	excluded := filepath.Join(helper.ProvisioningPath, "unrelated-folder", "unrelated-dash.json")
	_, err := os.Stat(excluded)
	require.True(t, os.IsNotExist(err),
		"dashboard outside any requested ref should not be exported: %s", excluded)
}

// makeFolder creates an unmanaged folder via the folder API. parentUID is the
// grafana.app/folder annotation; "" places the folder at the root.
func makeFolder(t *testing.T, helper *common.ProvisioningTestHelper, ctx context.Context, title, parentUID string) *unstructured.Unstructured {
	t.Helper()
	annotations := map[string]interface{}{}
	if parentUID != "" {
		annotations["grafana.app/folder"] = parentUID
	}
	folder := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
			"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]interface{}{
				"name":        slugify(title),
				"annotations": annotations,
			},
			"spec": map[string]interface{}{
				"title": title,
			},
		},
	}
	created, err := helper.Folders.Resource.Create(ctx, folder, metav1.CreateOptions{})
	require.NoError(t, err, "create folder %q", title)
	return created
}

// makeDashboardInFolder creates an unmanaged dashboard whose
// grafana.app/folder annotation places it inside folderUID. When folderUID is
// empty the annotation is omitted so the dashboard lives at the namespace root.
func makeDashboardInFolder(t *testing.T, helper *common.ProvisioningTestHelper, ctx context.Context, title, folderUID string) *unstructured.Unstructured {
	t.Helper()
	annotations := map[string]interface{}{}
	if folderUID != "" {
		annotations["grafana.app/folder"] = folderUID
	}
	dashboard := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name":        slugify(title),
				"annotations": annotations,
			},
			"spec": map[string]interface{}{
				"title":         title,
				"schemaVersion": 41,
			},
		},
	}
	created, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "create dashboard %q", title)
	return created
}

// slugify is a minimal helper for deriving stable folder/dashboard UIDs from
// the test fixture titles so the assertions can predict the resulting file
// paths without round-tripping through the API server.
func slugify(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'A' && c <= 'Z':
			out = append(out, c+('a'-'A'))
		case (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'):
			out = append(out, c)
		case c == ' ' || c == '_':
			out = append(out, '-')
		}
	}
	return string(out)
}
