package git

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	apis "github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// folderScopedViewerREST creates an org Viewer with dashboards:read/write/create/delete
// scoped to repo's root folder (Folder Admin style - see issue #127254) and returns a
// REST client for them. The grant targets the repo's root folder, not a subfolder:
// this package runs with WithoutProvisioningFolderMetadata, so subfolder UIDs are
// hash-derived rather than stable, but RBAC's ancestor-permission cascade from the
// root grant still covers descendants like "team-a/".
func folderScopedViewerREST(t *testing.T, helper *common.GitTestHelper, name, repo string) *rest.RESTClient {
	t.Helper()
	folderUser := helper.CreateUser(name, apis.Org1, org.RoleViewer, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:create", "dashboards:delete"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        repo,
		},
	})
	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	return folderUser.RESTClient(t, gv)
}

// postJob submits a job as restClient and returns the response status code and error.
func postJob(t *testing.T, restClient *rest.RESTClient, repo string, spec provisioning.JobSpec) (int, error) {
	t.Helper()
	var statusCode int
	result := restClient.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(common.AsJSON(spec)).
		SetHeader("Content-Type", "application/json").
		Do(t.Context()).StatusCode(&statusCode)
	return statusCode, result.Error()
}

// TestIntegrationGit_MoveDeleteJob_BranchAuthorization covers the fix for issue
// #127254 end-to-end against a real git server, specifically for the branch
// workflow case the shipped-then-rejected Editor-fallback would have blocked: a
// folder-scoped Viewer (no Editor role) can move and delete against a branch
// other than the repository's configured one, exactly as they can on the
// configured branch, because authorization now reads the actual target ref's
// content instead of requiring provisioning.jobs:create as a blanket substitute.
func TestIntegrationGit_MoveDeleteJob_BranchAuthorization(t *testing.T) {
	helper := sharedGitHelper(t)

	t.Run("delete on a branch that doesn't exist yet is authorized via the configured-branch fallback", func(t *testing.T) {
		const repo = "branch-auth-not-yet-created"
		helper.CreateFolderTargetGitRepo(t, repo, map[string][]byte{
			"team-a/dashboard.json": common.DashboardJSON("not-yet-created-dash", "Not Yet Created", 1),
		}, "write", "branch")
		helper.SyncAndWait(t, repo)
		helper.RequireRepoDashboardCount(t, repo, 1)

		restClient := folderScopedViewerREST(t, helper, "NotYetCreatedBranchUser", repo)

		// "future-feature-branch" was never pushed to the git server: resolveFileGVR's
		// ErrRefNotFound fallback should read the configured branch's content instead.
		statusCode, err := postJob(t, restClient, repo, provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dashboard.json"},
				Ref:   "future-feature-branch",
			},
		})
		require.NoError(t, err, "folder-scoped user should be authorized via the configured-branch fallback")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})

	t.Run("move on an existing feature branch with matching content succeeds", func(t *testing.T) {
		const repo = "branch-auth-existing-branch"
		const branch = "feature-existing"
		_, local := helper.CreateFolderTargetGitRepo(t, repo, map[string][]byte{
			"team-a/dashboard.json": common.DashboardJSON("existing-branch-dash", "Existing Branch", 1),
		}, "write", "branch")
		helper.SyncAndWait(t, repo)
		helper.RequireRepoDashboardCount(t, repo, 1)

		_, err := local.Git("checkout", "-b", branch)
		require.NoError(t, err)
		_, err = local.Git("push", "-u", "origin", branch)
		require.NoError(t, err)

		restClient := folderScopedViewerREST(t, helper, "ExistingBranchUser", repo)

		statusCode, err := postJob(t, restClient, repo, provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"team-a/dashboard.json"},
				TargetPath: "team-a/moved-dashboard.json",
				Ref:        branch,
			},
		})
		require.NoError(t, err, "folder-scoped user should be authorized against the feature branch's actual content")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})

	t.Run("configured-branch behavior is unchanged", func(t *testing.T) {
		const repo = "branch-auth-configured-branch"
		helper.CreateFolderTargetGitRepo(t, repo, map[string][]byte{
			"team-a/dashboard.json": common.DashboardJSON("configured-branch-dash", "Configured Branch", 1),
		}, "write", "branch")
		helper.SyncAndWait(t, repo)
		helper.RequireRepoDashboardCount(t, repo, 1)

		restClient := folderScopedViewerREST(t, helper, "ConfiguredBranchUser", repo)

		statusCode, err := postJob(t, restClient, repo, provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"team-a/dashboard.json"},
			},
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})
}

// TestIntegrationGit_MoveDeleteJob_BranchKindConfusionDenied is the security-side
// counterpart: authorization must reflect the ref actually being acted on, not
// just any branch's content. A "poisoned" branch where the target path has been
// replaced with a different resource kind must be denied, while the identical
// request against the configured branch (whose content is untouched) still
// succeeds - proving it's the branch's content that matters, not a blanket deny.
func TestIntegrationGit_MoveDeleteJob_BranchKindConfusionDenied(t *testing.T) {
	helper := sharedGitHelper(t)

	const repo = "branch-kind-confusion-denied"
	const branch = "poisoned-branch"
	const path = "team-a/dashboard.json"
	_, local := helper.CreateFolderTargetGitRepo(t, repo, map[string][]byte{
		path: common.DashboardJSON("kind-confusion-dash", "Kind Confusion", 1),
	}, "write", "branch")
	helper.SyncAndWait(t, repo)
	helper.RequireRepoDashboardCount(t, repo, 1)

	// On the feature branch, the same path is replaced with a folder manifest -
	// simulating content that legitimately differs by branch (e.g. someone else's
	// in-progress branch work), which is exactly the scenario a caller-supplied ref
	// must be evaluated against rather than assumed to match the configured branch.
	_, err := local.Git("checkout", "-b", branch)
	require.NoError(t, err)
	require.NoError(t, local.UpdateFile(path, string(folderJSON("poisoned-folder-uid", "Poisoned"))))
	_, err = local.Git("add", path)
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "replace dashboard with folder manifest")
	require.NoError(t, err)
	_, err = local.Git("push", "-u", "origin", branch)
	require.NoError(t, err)

	restClient := folderScopedViewerREST(t, helper, "KindConfusionUser", repo)

	t.Run("denied against the poisoned branch", func(t *testing.T) {
		statusCode, err := postJob(t, restClient, repo, provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{path},
				Ref:   branch,
			},
		})
		require.Error(t, err, "authorization must reflect the poisoned branch's actual content, not resolve it as a dashboard")
		require.NotEqual(t, http.StatusAccepted, statusCode)
	})

	t.Run("still succeeds against the configured branch", func(t *testing.T) {
		statusCode, err := postJob(t, restClient, repo, provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{path},
			},
		})
		require.NoError(t, err, "the configured branch's content is untouched, so this must still succeed")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})
}
