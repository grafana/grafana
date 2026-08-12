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

// TestIntegrationProvisioning_JobsFolderAuthorization covers the jobs subresource
// fallback that lets users with dashboards:write on a folder-targeted repository
// root folder manage jobs without global jobs:create (issue #127254).
func TestIntegrationProvisioning_JobsFolderAuthorization(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "jobs-folder-auth"
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

	// Org Viewer with dashboards:write on the repo root folder (Folder Admin style).
	// No Editor role, so global jobs:create is denied and the folder fallback applies.
	folderWriter := helper.CreateUser("FolderJobsWriter", apis.Org1, org.RoleViewer, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:create", "dashboards:delete"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        repo,
		},
	})
	gv := &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"}
	folderWriterREST := folderWriter.RESTClient(t, gv)

	t.Run("folder writer can list repository jobs", func(t *testing.T) {
		var statusCode int
		result := folderWriterREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "folder writer should list jobs via dashboards:write fallback")
		require.Equal(t, http.StatusOK, statusCode)
	})

	t.Run("viewer without folder write cannot list repository jobs", func(t *testing.T) {
		var statusCode int
		result := helper.ViewerREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error())
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})

	t.Run("folder writer can create delete job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"dashboard.json"},
			},
		})

		var statusCode int
		result := folderWriterREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.NoError(t, result.Error(), "folder writer should create delete job via folder fallback")
		require.Equal(t, http.StatusAccepted, statusCode)

		helper.AwaitJobs(t, repo)
	})

	t.Run("viewer cannot create delete job", func(t *testing.T) {
		helper.CopyToProvisioningPath(t, "../testdata/all-panels.json", "viewer-blocked.json")
		helper.SyncAndWait(t, repo, nil)

		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"viewer-blocked.json"},
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

		require.Error(t, result.Error())
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})

	t.Run("folder writer cannot create migrate job", func(t *testing.T) {
		// Migrate re-requires jobs:create so the folder fallback cannot open it.
		body := common.AsJSON(provisioning.JobSpec{
			Action:  provisioning.JobActionMigrate,
			Migrate: &provisioning.MigrateJobOptions{},
		})

		var statusCode int
		result := folderWriterREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "folder writer must not create migrate jobs")
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})

	t.Run("folder writer cannot create push job", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push:   &provisioning.ExportJobOptions{},
		})

		var statusCode int
		result := folderWriterREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error(), "folder writer must not create push jobs")
		require.Equal(t, http.StatusForbidden, statusCode)
		require.True(t, apierrors.IsForbidden(result.Error()))
	})
}
