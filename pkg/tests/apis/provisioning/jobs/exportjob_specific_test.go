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
func TestIntegrationProvisioning_ExportSpecificResources_FolderRecursive(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Build:  parent/  (requested)
	//          ├─ child/
	//          │    └─ dash-in-child
	//          └─ dash-in-parent
	//         sibling/  (NOT requested)
	//          └─ dash-in-sibling
	parent := makeFolder(t, helper, ctx, "parent-title", "")
	child := makeFolder(t, helper, ctx, "child-title", parent.GetName())
	sibling := makeFolder(t, helper, ctx, "sibling-title", "")

	dashInParent := makeDashboardInFolder(t, helper, ctx, "Dash in parent", parent.GetName())
	dashInChild := makeDashboardInFolder(t, helper, ctx, "Dash in child", child.GetName())
	dashInSibling := makeDashboardInFolder(t, helper, ctx, "Dash in sibling", sibling.GetName())

	const repo = "selective-export-folder-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 3,
		ExpectedFolders:    3,
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

	// Both subtree dashboards should be written under their natural folder
	// paths. ExportFolders runs ahead of the selective path so the parent
	// directory hierarchy resolves regardless of which folders were requested.
	parentDash := filepath.Join(helper.ProvisioningPath, "parent-title", "dash-in-parent.json")
	require.FileExists(t, parentDash, "dashboard in requested folder should be exported")
	childDash := filepath.Join(helper.ProvisioningPath, "parent-title", "child-title", "dash-in-child.json")
	require.FileExists(t, childDash, "dashboard in descendant folder should be exported recursively")

	// The sibling dashboard sits outside the requested subtree and must be
	// excluded even though ExportFolders emitted the sibling folder dir.
	siblingDash := filepath.Join(helper.ProvisioningPath, "sibling-title", "dash-in-sibling.json")
	_, err := os.Stat(siblingDash)
	require.True(t, os.IsNotExist(err),
		"dashboard outside the requested subtree should not be exported: %s", siblingDash)

	_ = dashInParent
	_ = dashInChild
	_ = dashInSibling
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
// grafana.app/folder annotation places it inside folderUID.
func makeDashboardInFolder(t *testing.T, helper *common.ProvisioningTestHelper, ctx context.Context, title, folderUID string) *unstructured.Unstructured {
	t.Helper()
	dashboard := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name": slugify(title),
				"annotations": map[string]interface{}{
					"grafana.app/folder": folderUID,
				},
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
