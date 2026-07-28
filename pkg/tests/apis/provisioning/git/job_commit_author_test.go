package git

import (
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIntegrationGit_DeleteJob_CommitAuthor(t *testing.T) {
	helper := sharedGitHelper(t)

	const (
		repoName = "job-commit-author"
		dashUID  = "job-author-dash"
		dashFn   = "dashboard.json"
	)

	_, local := helper.CreateExportGitRepo(t, repoName, map[string][]byte{
		dashFn: common.DashboardJSON(dashUID, "Dashboard to delete", 1),
	})
	helper.SyncAndWait(t, repoName)

	user := helper.CreateUser("job-author-user", "Org1", org.RoleEditor, nil)
	helper.SetPermissions(user, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:create", "dashboards:delete"},
			Resource:          "dashboards",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	})
	userREST := user.RESTClient(t, &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"})

	result := userREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("jobs").
		Body(common.AsJSON(provisioning.JobSpec{
			Action:  provisioning.JobActionDelete,
			Message: "Delete dashboard via JobSpec",
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{dashFn},
			},
		})).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())
	obj, err := result.Get()
	require.NoError(t, err, "should trigger delete job")
	unstruct, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok)
	helper.AwaitJob(t, unstruct)

	name, email := user.Identity.GetName(), user.Identity.GetEmail()
	require.NotEmpty(t, name)
	require.NotEmpty(t, email)
	require.Equal(t, fmt.Sprintf("%s <%s>", name, email), common.LatestCommitAuthor(t, local, "main"))
}
