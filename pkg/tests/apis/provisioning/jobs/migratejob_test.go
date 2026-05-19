package jobs

import (
	"context"
	"fmt"
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

// TestIntegrationProvisioning_PullJobUnmanagedConflict verifies that a pull/sync
// job produces a warning when it encounters a pre-existing unmanaged resource
// with the same name as a file in the repository.
func TestIntegrationProvisioning_PullJobUnmanagedConflict(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Step 1: Create an unmanaged dashboard directly via the API.
	unmanagedDash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	created, err := helper.DashboardsV1.Resource.Create(ctx, unmanagedDash, metav1.CreateOptions{})
	require.NoError(t, err, "should create unmanaged dashboard")
	dashName := created.GetName()
	t.Logf("Created unmanaged dashboard: %s", dashName)

	// Verify it is truly unmanaged (no manager annotation).
	dash, err := helper.DashboardsV1.Resource.Get(ctx, dashName, metav1.GetOptions{})
	require.NoError(t, err)
	managerID := dash.GetAnnotations()[utils.AnnoKeyManagerIdentity]
	require.Empty(t, managerID, "dashboard should be unmanaged before sync")

	// Step 2: Create a repo with a file whose metadata.name matches the unmanaged dashboard.
	const repo = "unmanaged-conflict-repo"
	repoPath := filepath.Join(helper.ProvisioningPath, repo)
	require.NoError(t, os.MkdirAll(repoPath, 0o750))

	dashFileContent := fmt.Sprintf(`{
  "apiVersion": "dashboard.grafana.app/v1beta1",
  "kind": "Dashboard",
  "metadata": {
    "name": %q
  },
  "spec": {
    "title": "Dashboard from repo (same name)",
    "schemaVersion": 41
  }
}`, dashName)
	require.NoError(t, os.WriteFile(filepath.Join(repoPath, "conflict-dashboard.json"), []byte(dashFileContent), 0o600))

	testRepo := common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		LocalPath:              repoPath,
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Step 3: Trigger a pull job — it should hit the unmanaged conflict.
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	// Step 4: Verify the job completed with a warning (not error, not success).
	jobObj := &provisioning.Job{}
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	t.Logf("Job state: %s", jobObj.Status.State)
	t.Logf("Job warnings: %v", jobObj.Status.Warnings)
	t.Logf("Job errors: %v", jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"job should complete with warning for unmanaged conflict")
	require.NotEmpty(t, jobObj.Status.Warnings, "should have warning details")
	require.Empty(t, jobObj.Status.Errors, "unmanaged conflicts should be warnings, not errors")

	found := false
	for _, msg := range jobObj.Status.Warnings {
		if strings.Contains(msg, "already exists and is not managed") {
			found = true
			break
		}
	}
	require.True(t, found, "should have unmanaged conflict warning, got: %v", jobObj.Status.Warnings)

	// Step 5: Verify the original dashboard is still unmanaged and unchanged.
	dash, err = helper.DashboardsV1.Resource.Get(ctx, dashName, metav1.GetOptions{})
	require.NoError(t, err, "unmanaged dashboard should still exist")
	managerID = dash.GetAnnotations()[utils.AnnoKeyManagerIdentity]
	require.Empty(t, managerID, "dashboard should remain unmanaged after sync warning")
}

// TestIntegrationProvisioning_MigrateTakeover verifies the full migration flow:
// 1. Pre-existing unmanaged dashboards are exported to the repo (Export phase).
// 2. The Sync phase takes them over because they appear in the takeover allowlist.
// 3. After migration, the dashboards are managed by the repository.
func TestIntegrationProvisioning_MigrateTakeover(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Step 1: Create two unmanaged dashboards directly.
	dash1 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	created1, err := helper.DashboardsV1.Resource.Create(ctx, dash1, metav1.CreateOptions{})
	require.NoError(t, err, "should create first unmanaged dashboard")
	dashName1 := created1.GetName()
	t.Logf("Created unmanaged dashboard 1: %s", dashName1)

	dash2 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	created2, err := helper.DashboardsV2beta1.Resource.Create(ctx, dash2, metav1.CreateOptions{})
	require.NoError(t, err, "should create second unmanaged dashboard")
	dashName2 := created2.GetName()
	t.Logf("Created unmanaged dashboard 2: %s", dashName2)

	// Step 2: Create a repository targeting the whole instance.
	const repo = "migrate-takeover-repo"
	testRepo := common.TestRepo{
		Name:               repo,
		SyncTarget:         "instance",
		Workflows:          []string{"write"},
		Copies:             map[string]string{},
		ExpectedDashboards: 2,
		ExpectedFolders:    0,
	}
	helper.CreateLocalRepo(t, testRepo)

	// Step 3: Trigger a migration job (export + sync).
	spec := provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message: "Migrate unmanaged dashboards",
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	// Step 4: After migration, both dashboards should be managed by the repository.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		d1, err := helper.DashboardsV1.Resource.Get(ctx, dashName1, metav1.GetOptions{})
		if !assert.NoError(collect, err, "dashboard 1 should still exist") {
			return
		}
		assert.Equal(collect, repo, d1.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"dashboard 1 should be managed by the repo after migration")

		d2, err := helper.DashboardsV1.Resource.Get(ctx, dashName2, metav1.GetOptions{})
		if !assert.NoError(collect, err, "dashboard 2 should still exist") {
			return
		}
		assert.Equal(collect, repo, d2.GetAnnotations()[utils.AnnoKeyManagerIdentity],
			"dashboard 2 should be managed by the repo after migration")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "both dashboards should become managed after migration")

	// Step 5: Verify no warnings or errors on the completed migration job.
	result, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "jobs")
	require.NoError(t, err)
	list, err := result.ToList()
	require.NoError(t, err)
	require.NotEmpty(t, list.Items)

	var migrateJob *unstructured.Unstructured
	for i := range list.Items {
		action, _, _ := unstructured.NestedString(list.Items[i].Object, "spec", "action")
		if action == string(provisioning.JobActionMigrate) {
			migrateJob = &list.Items[i]
			break
		}
	}
	require.NotNil(t, migrateJob, "should find the migrate job in the history")

	migrateJobObj := &provisioning.Job{}
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(migrateJob.Object, migrateJobObj)
	require.NoError(t, err)

	require.Equal(t, provisioning.JobStateSuccess, migrateJobObj.Status.State,
		"migration job should complete successfully")
	require.Empty(t, migrateJobObj.Status.Errors, "migration job should have no errors")
	require.Empty(t, migrateJobObj.Status.Warnings,
		"migration job should have no warnings when all resources were exported and taken over")
}

// TestIntegrationProvisioning_SecondMigrateOnlyExportsNewDashboards verifies that
// when a second repository migrates, only unmanaged dashboards are exported.
// Dashboards already claimed by the first repository are skipped.
// This test focuses on files written to each repository directory.
func TestIntegrationProvisioning_SecondMigrateOnlyExportsNewDashboards(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	// Create two unmanaged dashboards.
	dashboard1 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err := helper.DashboardsV1.Resource.Create(ctx, dashboard1, metav1.CreateOptions{})
	require.NoError(t, err, "should create first dashboard")

	dashboard2 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	_, err = helper.DashboardsV2beta1.Resource.Create(ctx, dashboard2, metav1.CreateOptions{})
	require.NoError(t, err, "should create second dashboard")

	// Create repo1 and migrate — should export both dashboards.
	const repo1 = "first-repository"
	repo1Path := filepath.Join(helper.ProvisioningPath, repo1)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:               repo1,
		SyncTarget:         "folder",
		Workflows:          []string{"write"},
		LocalPath:          repo1Path,
		Copies:             map[string]string{},
		ExpectedDashboards: 2,
		ExpectedFolders:    1,
	})

	helper.TriggerJobAndWaitForSuccess(t, repo1, provisioning.JobSpec{
		Action:  provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{Message: "initial migration"},
	})

	repo1FilesAfterMigrate, err := common.CountFilesInDir(repo1Path)
	require.NoError(t, err)
	require.Equal(t, 2, repo1FilesAfterMigrate,
		"repo1 should have 2 exported files after migration")

	// Create repo2 and sync it (no migration yet — just so it exists).
	const repo2 = "second-repository"
	repo2Path := filepath.Join(helper.ProvisioningPath, repo2)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo2,
		SyncTarget:             "folder",
		Workflows:              []string{"write"},
		LocalPath:              repo2Path,
		Copies:                 map[string]string{},
		SkipResourceAssertions: true,
	})

	// Create a third dashboard that is still unmanaged.
	dashboard3 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v0.yaml")
	_, err = helper.DashboardsV0.Resource.Create(ctx, dashboard3, metav1.CreateOptions{})
	require.NoError(t, err, "should create third dashboard")

	// Migrate repo2 — should only export dashboard3 (the unmanaged one).
	helper.TriggerJobAndWaitForSuccess(t, repo2, provisioning.JobSpec{
		Action:  provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{Message: "second migration"},
	})

	// Verify repo1 still has the same number of files (no new exports).
	repo1FilesAfterSecond, err := common.CountFilesInDir(repo1Path)
	require.NoError(t, err)
	require.Equal(t, repo1FilesAfterMigrate, repo1FilesAfterSecond,
		"repo1 file count should be unchanged after second migration")

	// Verify repo2 has exactly 1 file (only dashboard3).
	repo2Files, err := common.CountFilesInDir(repo2Path)
	require.NoError(t, err)
	require.Equal(t, 1, repo2Files,
		"repo2 should only export the unmanaged dashboard")
}
