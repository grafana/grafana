package jobs

import (
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
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_PullJobFolderDepthExceeded verifies that paths
// deeper than the folder API's maximum folder depth surface as warnings on the
// sync job (so the job is not requeued forever) and that descendant resources
// are short-circuited instead of producing a burst of identical bad requests.
//
// The default DefaultMaxNestedFolderDepth is 4 and the hard ceiling
// (maxNestedFolderDepth) is 7, so the deep path here uses 8 nested directories
// to guarantee a depth violation regardless of configuration.
func TestIntegrationProvisioning_PullJobFolderDepthExceeded(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "folder-depth-exceeded-repo"
	const deepDir = "level1/level2/level3/level4/level5/level6/level7/level8"

	repoPath := filepath.Join(helper.ProvisioningPath, repo)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":    "shallow/dashboard1.json",
			"../testdata/text-options.json":  deepDir + "/dashboard2.json",
			"../testdata/timeline-demo.json": deepDir + "/dashboard3.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	t.Logf("Job state: %s", jobObj.Status.State)
	t.Logf("Job message: %s", jobObj.Status.Message)
	t.Logf("Job warnings: %v", jobObj.Status.Warnings)
	t.Logf("Job errors: %v", jobObj.Status.Errors)
	for _, s := range jobObj.Status.Summary {
		t.Logf("Summary: group=%s kind=%s create=%d warning=%d error=%d warnings=%v",
			s.Group, s.Kind, s.Create, s.Warning, s.Error, s.Warnings)
	}

	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
		"depth-exceeded folders must be reported as warnings so the job queue does not retry the sync forever")
	require.Empty(t, jobObj.Status.Errors,
		"depth-exceeded folders must not contribute to Status.Errors; treating them as errors triggers a 5-minute retry loop")
	require.NotEmpty(t, jobObj.Status.Warnings, "expected at least one warning describing the depth violation")

	// Exactly one folder-depth warning is expected: the offending leaf folder.
	// Deeper descendants would also violate the limit but must be suppressed by
	// the failedCreations short-circuit so we don't burst-write identical bad
	// requests against the folder API.
	depthWarnings := 0
	for _, w := range jobObj.Status.Warnings {
		if strings.Contains(w, "folder max depth exceeded") {
			depthWarnings++
		}
	}
	require.Equal(t, 1, depthWarnings,
		"expected exactly one folder-depth warning; saw %d. Warnings: %v",
		depthWarnings, jobObj.Status.Warnings)

	// Sibling dashboards under the depth-violating folder must not produce
	// their own retryable errors — they should be silently skipped because the
	// parent path already failed.
	for _, e := range jobObj.Status.Errors {
		require.NotContains(t, e, deepDir,
			"resources under a depth-violating folder must not surface as errors")
	}

	// The shallow dashboard (outside the depth-violating subtree) must still
	// be created — a depth violation in one branch must not block the rest of
	// the sync.
	helper.RequireRepoDashboardCount(t, repo, 1)

	// Resources under the depth-violating folder must not exist in Grafana,
	// but the legal ancestors up to the depth limit are created normally.
	// `grafana.app/sourcePath` stores folder paths without a trailing slash,
	// e.g. "shallow", "level1/level2".
	folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)

	managedSourcePaths := make(map[string]struct{})
	for _, f := range folders.Items {
		managerID, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId")
		if managerID != repo {
			continue
		}
		sourcePath, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/sourcePath")
		managedSourcePaths[sourcePath] = struct{}{}
	}

	// The shallow folder must be created normally despite the depth violation
	// in another branch.
	assert.Contains(t, managedSourcePaths, "shallow",
		"the shallow folder must be created normally despite the depth violation in another branch; got managed paths: %v",
		managedSourcePaths)

	// The deepest folder in the test tree must not exist. The folder API's
	// hard ceiling for max depth is 7, so the 8th nested folder is guaranteed
	// to fail under any valid configuration. This keeps the test stable
	// without coupling to the runtime value of MaxNestedFolderDepth.
	assert.NotContains(t, managedSourcePaths,
		"level1/level2/level3/level4/level5/level6/level7/level8",
		"the deepest folder must not be created — it exceeds the maximum folder depth allowed by the folder API")

	// Pull condition must be a warning state, not Failure. The condition
	// reason currently buckets generic warnings under ReasonCompletedWithWarnings;
	// we assert that explicitly so a future change to surface
	// ReasonFolderDepthExceeded on the condition has to update this assertion
	// intentionally.
	helper.WaitForConditionReason(t, repo,
		provisioning.ConditionTypePullStatus,
		provisioning.ReasonCompletedWithWarnings)

	// Re-running the sync must reproduce the same outcome (warning, not error)
	// without crashing or losing the previously-synced shallow dashboard. This
	// guards against regressions where a depth-exceeded result poisons the
	// repository state on the second pull.
	rerun := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	rerunObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(rerun.Object, rerunObj))
	require.Equal(t, provisioning.JobStateWarning, rerunObj.Status.State,
		"second pull should also surface the depth violation as a warning, not an error")
	require.Empty(t, rerunObj.Status.Errors)
	helper.RequireRepoDashboardCount(t, repo, 1)
}

// TestIntegrationProvisioning_PullJobFolderDepthExceeded_RecoversAfterFix
// verifies that once the offending deep path is removed from the repository,
// a subsequent sync recovers cleanly to a Success state without any leftover
// depth warning.
func TestIntegrationProvisioning_PullJobFolderDepthExceeded_RecoversAfterFix(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "folder-depth-recovery-repo"
	const deepDir = "a/b/c/d/e/f/g/h"
	deepDashboardRel := deepDir + "/dashboard.json"

	repoPath := filepath.Join(helper.ProvisioningPath, repo)
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		LocalPath:  repoPath,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "ok/dashboard.json",
			"../testdata/text-options.json": deepDashboardRel,
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
	require.Empty(t, jobObj.Status.Errors)

	// Remove the offending dashboard (and its now-empty parent directory tree)
	// to simulate the user fixing the repository. The shallow dashboard stays.
	require.NoError(t, os.Remove(filepath.Join(repoPath, deepDashboardRel)))
	require.NoError(t, os.RemoveAll(filepath.Join(repoPath, "a")))

	helper.SyncAndWait(t, repo, nil)
	helper.WaitForConditionReason(t, repo,
		provisioning.ConditionTypePullStatus,
		provisioning.ReasonSuccess)
	helper.RequireRepoDashboardCount(t, repo, 1)
}
