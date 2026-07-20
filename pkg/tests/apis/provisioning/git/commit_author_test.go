package git

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIntegrationGit_Files_CommitAuthor(t *testing.T) {
	helper := sharedGitHelper(t)

	repoName := "commit-author"
	_, local := helper.CreateGitRepo(t, repoName, nil, "write")

	user := helper.CreateUser("commit-author-user", "Org1", org.RoleEditor, nil)
	userREST := user.RESTClient(t, &schema.GroupVersion{Group: "provisioning.grafana.app", Version: "v0alpha1"})

	result := userREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "dashboard.json").
		Param("message", "Create dashboard.json").
		Body(common.DashboardJSON("commit-author-dash", "Commit Author", 1)).
		SetHeader("Content-Type", "application/json").
		Do(t.Context())
	require.NoError(t, result.Error(), "should create file")

	name, email := user.Identity.GetName(), user.Identity.GetEmail()
	require.NotEmpty(t, name)
	require.NotEmpty(t, email)
	require.Equal(t, fmt.Sprintf("%s <%s>", name, email), common.LatestCommitAuthor(t, local, "main"))
}
