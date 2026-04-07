package foldermetadata

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationGit_FixFolderMetadata_Branch verifies that the fix-folder-metadata
// job creates _folder.json files on a feature branch when a Ref is specified, and
// leaves the default branch untouched.
func TestIntegrationGit_FixFolderMetadata_Branch(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "fix-meta-git-branch"
	const featureBranch = "add-folder-metadata"

	// Seed the repo with a dashboard nested under parent/child/ so the worker
	// sees two directories without _folder.json files. The "branch" workflow is
	// included so the repository accepts commits to new branches.
	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"parent/child/dashboard.json": common.DashboardJSON("git-meta-dash", "Git Meta Dashboard", 1),
	}, "write", "branch")

	// Run the fix-folder-metadata job targeting a new feature branch.
	// The job creates the branch from main and commits _folder.json files there.
	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionFixFolderMetadata,
		FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
			Ref: featureBranch,
		},
	})

	state, _, _ := unstructured.NestedString(job.Object, "status", "state")
	require.Equal(t, string(provisioning.JobStateSuccess), state,
		"fix-folder-metadata job on branch %q should succeed", featureBranch)

	// Both _folder.json files must appear on the feature branch with valid content.
	parentUID := requireFolderMetadataOnRef(t, helper, ctx, repoName, "parent/_folder.json", featureBranch)
	childUID := requireFolderMetadataOnRef(t, helper, ctx, repoName, "parent/child/_folder.json", featureBranch)

	require.NotEqual(t, parentUID, childUID,
		"parent and child folders should have different UIDs")

	// Neither file should exist on the default branch — the job only touched the
	// feature branch.
	requireFileAbsentOnDefaultBranch(t, helper, ctx, repoName, "parent/_folder.json")
	requireFileAbsentOnDefaultBranch(t, helper, ctx, repoName, "parent/child/_folder.json")
}

// TestIntegrationGit_FixFolderMetadata_ExistingBranch verifies that the
// fix-folder-metadata job works correctly when the target branch already exists
// in the remote repository. The job should reuse the existing branch rather
// than trying to create it, write the missing _folder.json files there, and
// leave the default branch untouched.
func TestIntegrationGit_FixFolderMetadata_ExistingBranch(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "fix-meta-git-existing-branch"
	const featureBranch = "pre-existing-branch"

	// Seed the repo and capture the local git clone so we can push the branch
	// to the remote before triggering the job.
	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"parent/child/dashboard.json": common.DashboardJSON("git-meta-existing", "Git Meta Existing", 1),
	}, "write", "branch")

	// Pre-create the branch on the remote so that ensureBranchExists takes the
	// "branch already exists" path instead of creating a new one.
	_, err := local.Git("checkout", "-b", featureBranch)
	require.NoError(t, err, "failed to create feature branch locally")
	_, err = local.Git("push", "origin", featureBranch)
	require.NoError(t, err, "failed to push feature branch to remote")

	// Run the fix-folder-metadata job targeting the already-existing branch.
	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionFixFolderMetadata,
		FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
			Ref: featureBranch,
		},
	})

	state, _, _ := unstructured.NestedString(job.Object, "status", "state")
	require.Equal(t, string(provisioning.JobStateSuccess), state,
		"fix-folder-metadata job on pre-existing branch %q should succeed", featureBranch)

	// Both _folder.json files must appear on the feature branch with valid content.
	parentUID := requireFolderMetadataOnRef(t, helper, ctx, repoName, "parent/_folder.json", featureBranch)
	childUID := requireFolderMetadataOnRef(t, helper, ctx, repoName, "parent/child/_folder.json", featureBranch)

	require.NotEqual(t, parentUID, childUID,
		"parent and child folders should have different UIDs")

	// Neither file should exist on the default branch.
	requireFileAbsentOnDefaultBranch(t, helper, ctx, repoName, "parent/_folder.json")
	requireFileAbsentOnDefaultBranch(t, helper, ctx, repoName, "parent/child/_folder.json")
}

// TestIntegrationGit_FixFolderMetadata_ReadOnlyDefaultBranch verifies that the
// fix-folder-metadata job is rejected when the repository only has the "branch"
// workflow (no "write"). Without a Ref targeting a feature branch, the job
// would push directly to main, which is not allowed.
func TestIntegrationGit_FixFolderMetadata_ReadOnlyDefaultBranch(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "fix-meta-readonly-main"

	// Create a repo with only the "branch" workflow — no "write" means the
	// default branch (main) is read-only and the worker must not push there.
	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"parent/child/dashboard.json": common.DashboardJSON("git-ro-dash", "Git ReadOnly Dashboard", 1),
	}, "branch")

	// Submitting a fix-folder-metadata job WITHOUT a Ref should be rejected
	// because the repo does not have the "write" workflow, so targeting the
	// default branch is forbidden.
	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionFixFolderMetadata,
	})
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(ctx)

	require.True(t, apierrors.IsForbidden(result.Error()),
		"job targeting the default branch on a read-only repo should be forbidden; got: %v", result.Error())

	// The default branch (main) must remain untouched.
	requireFileAbsentOnDefaultBranch(t, helper, ctx, repoName, "parent/_folder.json")
	requireFileAbsentOnDefaultBranch(t, helper, ctx, repoName, "parent/child/_folder.json")
}

// TestIntegrationGit_FixFolderMetadata_ReadOnlyDefaultBranch_WithRef verifies
// that when the repository only has the "branch" workflow (default branch is
// read-only), the fix-folder-metadata job succeeds if a Ref targeting a feature
// branch is provided. The _folder.json files are committed to the feature
// branch and the default branch stays untouched.
func TestIntegrationGit_FixFolderMetadata_ReadOnlyDefaultBranch_WithRef(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "fix-meta-readonly-branch"
	const featureBranch = "fix-folders"

	helper.CreateGitRepo(t, repoName, map[string][]byte{
		"parent/child/dashboard.json": common.DashboardJSON("git-ro-branch-dash", "Git ReadOnly Branch Dashboard", 1),
	}, "branch")

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionFixFolderMetadata,
		FixFolderMetadata: &provisioning.FixFolderMetadataJobOptions{
			Ref: featureBranch,
		},
	})

	state, _, _ := unstructured.NestedString(job.Object, "status", "state")
	require.Equal(t, string(provisioning.JobStateSuccess), state,
		"fix-folder-metadata job on branch %q should succeed even when the default branch is read-only", featureBranch)

	parentUID := requireFolderMetadataOnRef(t, helper, ctx, repoName, "parent/_folder.json", featureBranch)
	childUID := requireFolderMetadataOnRef(t, helper, ctx, repoName, "parent/child/_folder.json", featureBranch)

	require.NotEqual(t, parentUID, childUID,
		"parent and child folders should have different UIDs")

	requireFileAbsentOnDefaultBranch(t, helper, ctx, repoName, "parent/_folder.json")
	requireFileAbsentOnDefaultBranch(t, helper, ctx, repoName, "parent/child/_folder.json")
}

// ── helpers ────────────────────────────────────────────────────────────────

func requireFolderMetadataOnRef(t *testing.T, h *common.GitTestHelper, ctx context.Context, repoName, filePath, ref string) string {
	t.Helper()

	subresourceParts := append([]string{"files"}, strings.Split(filePath, "/")...)
	result := h.AdminREST.Get().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource(subresourceParts...).
		Param("ref", ref).
		Do(ctx)

	require.NoError(t, result.Error(),
		"%s: _folder.json should be readable on branch %q", filePath, ref)

	wrapObj := &unstructured.Unstructured{}
	require.NoError(t, result.Into(wrapObj),
		"%s: failed to decode files API response for branch %q", filePath, ref)

	apiVersion, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "apiVersion")
	require.Equal(t, "folder.grafana.app/v1", apiVersion,
		"%s: unexpected apiVersion", filePath)
	kind, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "kind")
	require.Equal(t, "Folder", kind,
		"%s: unexpected kind", filePath)

	uid, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "metadata", "name")
	require.NotEmpty(t, uid, "%s: should have a non-empty UID", filePath)
	title, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "spec", "title")
	require.NotEmpty(t, title, "%s: should have a non-empty title", filePath)

	return uid
}

func requireFileAbsentOnDefaultBranch(t *testing.T, h *common.GitTestHelper, ctx context.Context, repoName, filePath string) {
	t.Helper()

	subresourceParts := append([]string{"files"}, strings.Split(filePath, "/")...)
	result := h.AdminREST.Get().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource(subresourceParts...).
		Do(ctx)

	require.True(t, apierrors.IsNotFound(result.Error()),
		"%s should not exist on the default branch; got: %v", filePath, result.Error())
}
