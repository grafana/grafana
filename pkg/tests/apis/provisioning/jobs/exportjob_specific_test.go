package jobs

import (
	"context"
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
	ctx := context.Background()

	// Pre-existing unmanaged folder hierarchy: grandparent > parent > child, with
	// an unmanaged dashboard in the deepest (child) folder.
	grandparentUID := helper.CreateUnmanagedFolder(t, ctx, "Selective Migrate Grandparent", "")
	parentUID := helper.CreateUnmanagedFolder(t, ctx, "Selective Migrate Parent", grandparentUID)
	childUID := helper.CreateUnmanagedFolder(t, ctx, "Selective Migrate Child", parentUID)
	dashName := helper.CreateUnmanagedDashboard(t, ctx, "Dashboard in nested unmanaged folder", childUID)

	const repo = "selective-migrate-nested-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 1,
		ExpectedFolders:    3,
	})

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
		d, err := helper.DashboardsV1.Resource.Get(ctx, dashName, metav1.GetOptions{})
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
			f, err := helper.Folders.Resource.Get(ctx, folderUID, metav1.GetOptions{})
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
