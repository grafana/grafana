package jobs

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_PullJobUnsupportedPath verifies that a full sync
// completes with a warning, not an error, when it finds a resource file whose
// path fails repository path validation (here: an unsafe character in the
// name). It also verifies the rest of the sync is unaffected -- a sibling
// dashboard with a valid path must still be created.
func TestIntegrationProvisioning_PullJobUnsupportedPath(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "unsupported-path-full-sync-repo"
	const unsafeName = "folder/Backend & UI.json"

	repoPath := filepath.Join(helper.ProvisioningPath, repo)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "folder/dashboard1.json",
			"../testdata/text-options.json": unsafeName,
		},
		SkipSync: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	t.Logf("job state: %s message: %s", jobObj.Status.State, jobObj.Status.Message)
	t.Logf("job warnings: %v", jobObj.Status.Warnings)
	t.Logf("job errors: %v", jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"an unsafe path must complete the sync as a warning, not an error")
	require.Empty(t, jobObj.Status.Errors,
		"an unsafe path is user-fixable content, not a system failure")
	require.NotEmpty(t, jobObj.Status.Warnings)

	found := false
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, unsafeName) && strings.Contains(w, "is not supported") {
			found = true
			break
		}
	}
	require.True(t, found, "expected a warning naming the unsafe file, got: %v", jobObj.Status.Warnings)

	// The valid sibling dashboard must still sync despite the unsupported
	// path elsewhere in the same pass.
	helper.RequireRepoDashboardCount(t, repo, 1)
}

func TestIntegrationProvisioning_PullJobRenameOntoUnsupportedPath(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "unsupported-path-full-sync-rename-repo"
	const unsafeName = "folder/Backend & UI.json"

	repoPath := filepath.Join(helper.ProvisioningPath, repo)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "folder/dashboard1.json",
			"../testdata/text-options.json": "folder/dashboard2.json",
		},
	})
	helper.RequireRepoDashboardCount(t, repo, 2)

	require.NoError(t, os.Rename(filepath.Join(repoPath, "folder", "dashboard2.json"), filepath.Join(repoPath, unsafeName)))

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
	t.Logf("job state: %s warnings: %v errors: %v", jobObj.Status.State, jobObj.Status.Warnings, jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
	require.Empty(t, jobObj.Status.Errors)
	found := false
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, unsafeName) && strings.Contains(w, "is not supported") {
			found = true
		}
	}
	require.True(t, found, "expected a warning naming the new path, got: %v", jobObj.Status.Warnings)

	// The renamed dashboard is gone with its old file, the other one is untouched.
	helper.RequireRepoDashboardCount(t, repo, 1)
}

func repoFolderTitles(t *testing.T, helper *common.ProvisioningTestHelper, repo string) []string {
	t.Helper()
	folders := helper.ListRepoFolders(t, repo)
	titles := make([]string, 0, len(folders))
	for _, f := range folders {
		title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
		titles = append(titles, title)
	}
	return titles
}

func pullAndRequireWarning(t *testing.T, helper *common.ProvisioningTestHelper, repo, path string) {
	t.Helper()
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
	t.Logf("job state: %s warnings: %v errors: %v", jobObj.Status.State, jobObj.Status.Warnings, jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
	require.Empty(t, jobObj.Status.Errors)
	found := false
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, path) && strings.Contains(w, "is not supported") {
			found = true
		}
	}
	require.True(t, found, "expected a warning naming %q, got: %v", path, jobObj.Status.Warnings)
}

// The unsafe part can be a folder, not only the file name: the safe part of the
// path must still exist in Grafana, and what sat under the unsafe folder must go.
func TestIntegrationProvisioning_PullJobUnsupportedFolderPath(t *testing.T) {
	helper := sharedHelper(t)

	t.Run("a folder moved onto an unsafe name", func(t *testing.T) {
		const repo = "unsupported-folder-path-move-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			LocalPath:  repoPath,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json":   "parent/old-dir/dashboard.json",
				"../testdata/text-options.json": "parent/other.json",
			},
		})
		helper.RequireRepoDashboardCount(t, repo, 2)
		require.Contains(t, repoFolderTitles(t, helper, repo), "old-dir")

		require.NoError(t, os.Rename(filepath.Join(repoPath, "parent", "old-dir"), filepath.Join(repoPath, "parent", "bad & dir")))

		pullAndRequireWarning(t, helper, repo, "parent/bad & dir/dashboard.json")

		helper.RequireRepoDashboardCount(t, repo, 1) // parent/other.json stays, the moved one is gone
		titles := repoFolderTitles(t, helper, repo)
		require.Contains(t, titles, "parent", "the safe part of the path exists")
		require.NotContains(t, titles, "old-dir", "the folder it left goes")
		require.NotContains(t, titles, "bad & dir", "the unsafe folder is never created")
	})

	t.Run("a new tree under an unsafe folder", func(t *testing.T) {
		const repo = "unsupported-folder-path-new-repo"
		repoPath := filepath.Join(helper.ProvisioningPath, repo)
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			LocalPath:  repoPath,
			SyncTarget: "folder",
			Copies: map[string]string{
				"../testdata/all-panels.json": "newparent/bad & dir/dashboard.json",
			},
			SkipSync: true,
		})

		pullAndRequireWarning(t, helper, repo, "newparent/bad & dir/dashboard.json")

		helper.RequireRepoDashboardCount(t, repo, 0)
		titles := repoFolderTitles(t, helper, repo)
		require.Contains(t, titles, "newparent", "the safe part of the path is created")
		require.NotContains(t, titles, "bad & dir")
	})
}
