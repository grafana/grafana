package jobs

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	apis "github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_FolderScopedUserCanMoveAndDeleteJobs covers the fix
// for issue #127254: moving or deleting a dashboard in a Git Sync folder used to
// require the global provisioning.jobs:create permission (Editor role), even for
// a user with full write access to the folder in question. Job creation is no
// longer gated on that global permission; move and delete are authorized purely
// against the dashboards/folders actually being touched, the same way they are
// authorized without Git Sync. Push, migrate and fixFolderMetadata still require
// Editor, since they have no equivalent per-resource check of their own.
func TestIntegrationProvisioning_FolderScopedUserCanMoveAndDeleteJobs(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "folder-scoped-jobs-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json": "dashboard.json",
		},
	})

	helper.RequireRepoDashboardCount(t, repo, 1)
	helper.RequireRepoFolderCount(t, repo, 1)

	// Org Viewer with dashboards:write/create/delete scoped to the repo's root
	// folder (Folder Admin style) - no Editor role, so the global
	// provisioning.jobs:create check that used to gate every job would fail.
	folderUser := helper.CreateUser("FolderScopedJobsUser", apis.Org1, org.RoleViewer, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:create", "dashboards:delete"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        repo,
		},
	})
	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	folderUserREST := folderUser.RESTClient(t, gv)

	t.Run("folder-scoped user can move a dashboard without Editor role", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"dashboard.json"},
				TargetPath: "moved/",
			},
		})

		var statusCode int
		result := folderUserREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "folder-scoped user should be able to move a dashboard they can write, without Editor role")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})

	t.Run("folder-scoped user can delete a dashboard without Editor role", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"moved/dashboard.json"},
			},
		})

		var statusCode int
		result := folderUserREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "folder-scoped user should be able to delete a dashboard they can write, without Editor role")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})

	t.Run("folder-scoped user still cannot push", func(t *testing.T) {
		helper.CopyToProvisioningPath(t, "../testdata/all-panels.json", "push-source.json")
		helper.SyncAndWait(t, repo, nil)

		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
		})

		var statusCode int
		result := folderUserREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "push must stay Editor-only even though job creation is no longer gated on jobs:create")
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})

	t.Run("folder-scoped user still cannot migrate", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action:  provisioning.JobActionMigrate,
			Migrate: &provisioning.MigrateJobOptions{},
		})

		var statusCode int
		result := folderUserREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "migrate must stay Editor-only")
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})

	t.Run("plain viewer with no folder permissions still cannot delete", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"push-source.json"},
			},
		})

		var statusCode int
		result := helper.ViewerREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "a viewer without folder write access must still be denied")
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})
}

// TestIntegrationProvisioning_EmptyDeleteAndMoveJobsRejected covers the other half
// of the #127254 fix: a delete or move job with no paths and no resources isn't a
// no-op. When Ref is empty the worker follows it with a full non-incremental
// sync, so it must be rejected outright rather than trivially authorized -
// otherwise removing the global jobs:create gate would let it through for anyone
// who can pass the (nonexistent, for an empty target) per-path checks.
func TestIntegrationProvisioning_EmptyDeleteAndMoveJobsRejected(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "empty-target-jobs-test"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:      repo,
		Workflows: []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json": "dashboard.json",
		},
	})

	helper.RequireRepoDashboardCount(t, repo, 1)

	t.Run("admin cannot create an empty delete job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{},
		})

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "a delete job with no paths and no resources must be rejected")
		require.Equal(t, http.StatusBadRequest, statusCode)
		require.True(t, apierrors.IsBadRequest(result.Error()))
	})

	t.Run("admin cannot create an empty move job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				TargetPath: "dest/",
			},
		})

		var statusCode int
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "a move job with no paths and no resources must be rejected")
		require.Equal(t, http.StatusBadRequest, statusCode)
		require.True(t, apierrors.IsBadRequest(result.Error()))
	})
}

// TestIntegrationProvisioning_MoveResourceRefRequiresTargetCreate covers the
// second gap fixed alongside #127254: a resource-reference move only checked
// update permission on the source, never create permission on the destination
// folder (unlike a path-based move, which checks both). A user with update-only
// permissions could use Move.Resources to move a dashboard into a folder they
// have no create access to.
func TestIntegrationProvisioning_MoveResourceRefRequiresTargetCreate(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "move-ref-target-test"
	dashboardContent := renameDashboard(t, helper.LoadFile("../testdata/all-panels.json"), "move-ref-target-dash")
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
	})
	helper.WriteToProvisioningPath(t, "dashboard.json", []byte(dashboardContent))
	helper.SyncAndWait(t, repo, nil)
	helper.RequireRepoDashboardCount(t, repo, 1)

	// Org Viewer with dashboards:read/write (update) everywhere, but no
	// dashboards:create anywhere - can update the moved dashboard's source
	// location, but must not be able to place it into a new folder.
	updateOnlyUser := helper.CreateUser("MoveRefUpdateOnlyUser", apis.Org1, org.RoleViewer, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"dashboards:read", "dashboards:write"},
			Resource:          "dashboards",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	})
	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	updateOnlyREST := updateOnlyUser.RESTClient(t, gv)

	body := common.AsJSON(provisioning.JobSpec{
		Action: provisioning.JobActionMove,
		Move: &provisioning.MoveJobOptions{
			TargetPath: "moved-by-ref/",
			Resources: []provisioning.ResourceRef{
				{Name: "move-ref-target-dash", Kind: "Dashboard", Group: "dashboard.grafana.app"},
			},
		},
	})

	var statusCode int
	result := updateOnlyREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(t.Context()).StatusCode(&statusCode)

	require.Error(t, result.Error(), "a resource-ref move must require create permission on the target folder, not just update on the source")
	require.Equal(t, http.StatusForbidden, statusCode)
	require.True(t, apierrors.IsForbidden(result.Error()))
}
