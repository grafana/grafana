package git

import (
	"strings"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

// TestIntegrationProvisioning_IncrementalSync_UnsupportedPath verifies that an
// incremental sync completes with a warning, not an error, when the new
// commit introduces a resource file whose path fails repository path
// validation (here: an unsafe character in the name). The previously-synced
// dashboard must remain untouched.
func TestIntegrationProvisioning_IncrementalSync_UnsupportedPath(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "incr-unsupported-path"
	const unsafeName = "Backend & UI.json"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("incr-unsupported-root", "Root Dashboard", 1),
	})

	// Full sync.
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	// Add a dashboard whose filename has an unsafe character.
	require.NoError(t, local.CreateFile(unsafeName, string(common.DashboardJSON("incr-unsupported-unsafe", "Unsafe Dashboard", 1))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add dashboard with an unsafe filename")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// Trigger incremental sync.
	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	t.Logf("job state: %s message: %s", jobObj.Status.State, jobObj.Status.Message)
	t.Logf("job warnings: %v", jobObj.Status.Warnings)
	t.Logf("job errors: %v", jobObj.Status.Errors)

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"an unsafe path must complete the incremental sync as a warning, not an error")
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

	// The previously-synced root dashboard must remain untouched.
	helper.RequireRepoDashboardCount(t, repoName, 1)
}

func TestIntegrationProvisioning_IncrementalSync_RenameOntoUnsupportedPath(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "incr-rename-unsupported-path"
	const unsafeName = "Backend & UI.json"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("incr-rename-root", "Root Dashboard", 1),
		"other.json":     common.DashboardJSON("incr-rename-other", "Other Dashboard", 1),
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	helper.RequireRepoDashboardCount(t, repoName, 2)

	_, err := local.Git("mv", "dashboard.json", unsafeName)
	require.NoError(t, err)
	_, err = local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "rename a dashboard to a name that cannot sync")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
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
	helper.RequireRepoDashboardCount(t, repoName, 1)
}

func repoFolderTitles(t *testing.T, helper *common.GitTestHelper, repo string) []string {
	t.Helper()
	folders := helper.ListRepoFolders(t, repo)
	titles := make([]string, 0, len(folders))
	for _, f := range folders {
		title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
		titles = append(titles, title)
	}
	return titles
}

func incrementalPullAndRequireWarning(t *testing.T, helper *common.GitTestHelper, repo, path string) {
	t.Helper()
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
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
func TestIntegrationProvisioning_IncrementalSync_FolderMovedOntoUnsupportedPath(t *testing.T) {
	helper := sharedGitHelper(t)

	{
		const repoName = "incr-unsupported-folder-move"
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"parent/old-dir/dashboard.json": common.DashboardJSON("incr-folder-move-a", "Moved Dashboard", 1),
			"parent/other.json":             common.DashboardJSON("incr-folder-move-b", "Other Dashboard", 1),
		})
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		helper.RequireRepoDashboardCount(t, repoName, 2)
		require.Contains(t, repoFolderTitles(t, helper, repoName), "old-dir")

		_, err := local.Git("mv", "parent/old-dir", "parent/bad & dir")
		require.NoError(t, err)
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "move a folder onto a name that cannot sync")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		incrementalPullAndRequireWarning(t, helper, repoName, "parent/bad & dir/dashboard.json")

		helper.RequireRepoDashboardCount(t, repoName, 1) // parent/other.json stays, the moved one is gone
		titles := repoFolderTitles(t, helper, repoName)
		require.Contains(t, titles, "parent", "the safe part of the path exists")
		require.NotContains(t, titles, "old-dir", "the folder it left goes")
		require.NotContains(t, titles, "bad & dir", "the unsafe folder is never created")
	}
}

// A new tree under an unsafe folder (see the test above for the moved one).
func TestIntegrationProvisioning_IncrementalSync_NewTreeUnderUnsupportedFolder(t *testing.T) {
	helper := sharedGitHelper(t)

	{
		const repoName = "incr-unsupported-folder-new"
		_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
			"dashboard.json": common.DashboardJSON("incr-folder-new-root", "Root Dashboard", 1),
		})
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

		require.NoError(t, local.CreateFile("newparent/bad & dir/dashboard.json", string(common.DashboardJSON("incr-folder-new-bad", "Unsafe Dashboard", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add a dashboard under a folder that cannot sync")
		require.NoError(t, err)
		_, err = local.Git("push")
		require.NoError(t, err)

		incrementalPullAndRequireWarning(t, helper, repoName, "newparent/bad & dir/dashboard.json")

		helper.RequireRepoDashboardCount(t, repoName, 1) // only the root one
		titles := repoFolderTitles(t, helper, repoName)
		require.Contains(t, titles, "newparent", "the safe part of the path is created")
		require.NotContains(t, titles, "bad & dir")
	}
}
