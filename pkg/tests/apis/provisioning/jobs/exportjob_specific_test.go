package jobs

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ExportSpecificResources verifies the selective
// export path: when Push.Resources names specific dashboards, only those
// dashboards are written to the repository and unrelated dashboards stay out
// of the exported tree.
func TestIntegrationProvisioning_ExportSpecificResources(t *testing.T) {
	helper := sharedHelper(t)

	// Five dashboards across every supported version; v0, v1, v2, v2beta1 are
	// named in Resources and expected to land in the repo, v2alpha1 is left
	// out to prove non-selected dashboards stay excluded.
	v0Dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v0.yaml")
	createdV0, err := helper.DashboardsV0.Resource.Create(t.Context(), v0Dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v0 dashboard")

	v1Dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	createdV1, err := helper.DashboardsV1.Resource.Create(t.Context(), v1Dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	v2Dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2.yaml")
	createdV2, err := helper.DashboardsV2.Resource.Create(t.Context(), v2Dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2 dashboard")

	v2alphaDash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2alpha1.yaml")
	createdV2alpha, err := helper.DashboardsV2alpha1.Resource.Create(t.Context(), v2alphaDash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2alpha1 dashboard")

	v2betaDash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	createdV2beta, err := helper.DashboardsV2beta1.Resource.Create(t.Context(), v2betaDash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2beta1 dashboard")

	const repo = "selective-export-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Workflows:  []string{"write"},
		Copies:     map[string]string{},
	}
	helper.CreateLocalRepo(t, testRepo)

	helper.RequireDashboards(t,
		createdV0.GetName(), createdV1.GetName(), createdV2.GetName(), createdV2alpha.GetName(), createdV2beta.GetName(),
	)
	helper.RequireRepoFolderCount(t, repo, 0)

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
	// v0 is the exception: it is relabeled to v1 on export so the synced file
	// remains loadable (see the conversion shim in jobs/export/resources.go).
	type expected struct {
		title      string
		origName   string
		apiVersion string
		fileName   string
	}
	for _, tt := range []expected{
		{title: "Test dashboard. Created at v0", origName: "test-v0", apiVersion: "dashboard.grafana.app/v1", fileName: "test-dashboard-created-at-v0.json"},
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

// TestIntegrationProvisioning_SelectiveMigrateDashboardInNestedFolders verifies the
// end-to-end selective migrate of a single dashboard that lives several levels
// deep in a pre-existing unmanaged folder hierarchy: the migrate job completes
// successfully and the dashboard ends up managed by the repository, parented
// under a fully-managed folder chain.
//
// Note: this package runs with the provisioningFolderMetadata flag disabled, so
// the export does not write a _folder.json preserving the original folder UIDs;
// the sync therefore creates fresh managed folders instead of taking over the
// original unmanaged ones. The unmanaged-parent-folder takeover path (the
// selective-migrate folder-conflict regression) requires that flag and is
// covered by the unit tests in
// pkg/registry/apis/provisioning/resources/folders_test.go
// (TestEnsureFolderExists_TakeoverAllowlist).
func TestIntegrationProvisioning_SelectiveMigrateDashboardInNestedFolders(t *testing.T) {
	helper := sharedHelper(t)

	// Pre-existing unmanaged folder hierarchy: grandparent > parent > child, with
	// an unmanaged dashboard in the deepest (child) folder.
	grandparentUID := helper.CreateUnmanagedFolder(t, "Selective Migrate Grandparent", "")
	parentUID := helper.CreateUnmanagedFolder(t, "Selective Migrate Parent", grandparentUID)
	childUID := helper.CreateUnmanagedFolder(t, "Selective Migrate Child", parentUID)
	dashName := helper.CreateUnmanagedDashboard(t, "Dashboard in nested unmanaged folder", childUID)

	// Selective migration is only supported for folder/folderless targets (an
	// instance target must migrate everything). folderless preserves the nested
	// folder hierarchy without a wrapper folder, so the ancestry assertions below
	// hold.
	const repo = "selective-migrate-nested-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folderless",
		Workflows:  []string{"write"},
		Copies:     map[string]string{},
	})

	helper.RequireDashboards(t, dashName)
	helper.RequireFolders(t, grandparentUID, parentUID, childUID)

	// Selective migrate naming only the dashboard. The folders are not named, but
	// the export emits the folder tree so the dashboard's nested path resolves.
	migrateJob := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message: "Selectively migrate one nested dashboard",
			Resources: []provisioning.ResourceRef{
				{Name: dashName, Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		},
	})
	common.HasNoErrors()(t, migrateJob)
	common.HasState(provisioning.JobStateSuccess)(t, migrateJob)

	// The dashboard is now managed by the repo, and every folder in its ancestry
	// (child > parent > grandparent) is managed by the repo too.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		d, err := helper.DashboardsV1.Resource.Get(t.Context(), dashName, metav1.GetOptions{})
		if !assert.NoError(collect, err, "dashboard should still exist") {
			return
		}
		assert.Equal(collect, repo, d.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"dashboard should be managed by the repo after migration")

		// Walk the parent chain from the dashboard up to the root, asserting each
		// folder is managed by the repo. Three folders deep proves the nested path
		// was fully created and claimed.
		depth := 0
		folderUID := d.GetAnnotations()[utils.AnnoKeyFolder]
		for folderUID != "" {
			f, err := helper.Folders.Resource.Get(t.Context(), folderUID, metav1.GetOptions{})
			if !assert.NoError(collect, err, "ancestor folder %q should exist", folderUID) {
				return
			}
			assert.Equal(collect, repo, f.GetAnnotations()[utils.AnnoKeyManagerIdentity],
				"ancestor folder %q should be managed by the repo", folderUID)
			depth++
			folderUID = f.GetAnnotations()[utils.AnnoKeyFolder]
		}
		assert.Equal(collect, 3, depth, "dashboard should sit under a 3-level managed folder chain")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should become managed under a managed nested folder chain")
}

// TestIntegrationProvisioning_ExportSpecificResources_NotFound verifies that
// naming a dashboard that does not exist finishes the job in error state
// with a "not found" error recorded against that resource. The caller asked
// for something that cannot be exported, so the job surfaces the failure
// rather than silently dropping the reference.
func TestIntegrationProvisioning_ExportSpecificResources_NotFound(t *testing.T) {
	helper := sharedHelper(t)

	// A real dashboard exists alongside the missing ref so we can assert the
	// partial-write behavior: present ones are still written even though the
	// job ends in error because of the missing sibling.
	v1Dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	createdV1, err := helper.DashboardsV1.Resource.Create(t.Context(), v1Dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	const repo = "selective-export-notfound-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Workflows:  []string{"write"},
		Copies:     map[string]string{},
	})

	helper.RequireDashboards(t, createdV1.GetName())
	helper.RequireRepoFolderCount(t, repo, 0)

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

// TestIntegrationProvisioning_ExportSpecificResources_GeneratesFolderAncestry
// verifies the selective-export folder behavior: only the folders required to
// place the named dashboard are written (its full parent ancestry, generated on
// demand even though those folders were not named), while folders belonging to
// unrelated, non-exported dashboards stay out of the repository entirely.
func TestIntegrationProvisioning_ExportSpecificResources_GeneratesFolderAncestry(t *testing.T) {
	helper := sharedHelper(t)

	// Two independent folder hierarchies, each holding one dashboard. Only the
	// dashboard in the "exported" hierarchy is named in the export; the
	// "unrelated" hierarchy must not be touched.
	exportedParent := helper.CreateUnmanagedFolder(t, "exportedparent", "")
	exportedChild := helper.CreateUnmanagedFolder(t, "exportedchild", exportedParent)
	selectedDash := helper.CreateUnmanagedDashboard(t, "selecteddash", exportedChild)

	unrelatedFolder := helper.CreateUnmanagedFolder(t, "unrelatedfolder", "")
	unrelatedDash := helper.CreateUnmanagedDashboard(t, "unrelateddash", unrelatedFolder)

	const repo = "selective-export-folders-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Workflows:  []string{"write"},
		Copies:     map[string]string{},
	})

	helper.RequireDashboards(t, selectedDash, unrelatedDash)
	helper.RequireFolders(t, exportedParent, exportedChild, unrelatedFolder)

	helper.DebugState(t, repo, "BEFORE SELECTIVE EXPORT")

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: selectedDash, Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	helper.DebugState(t, repo, "AFTER SELECTIVE EXPORT")
	common.PrintFileTree(t, helper.ProvisioningPath)

	// The named dashboard lands at its full nested path even though neither of
	// its parent folders was named in the export.
	selectedPath := filepath.Join(helper.ProvisioningPath, "exportedparent", "exportedchild", "selecteddash.json")
	_, err := os.Stat(selectedPath)
	require.NoError(t, err, "named dashboard should be exported at its generated nested path %s", selectedPath)

	// The unrelated hierarchy must not have been exported: neither its folder
	// directory nor its dashboard file may appear in the repository.
	files := helper.ListRepositoryFiles(t, repo)
	for _, f := range files {
		require.NotContains(t, f.Path, "unrelated",
			"unrelated folder/dashboard must not be exported during selective export; got file %q", f.Path)
	}
}
