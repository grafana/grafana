package git

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
)

func TestIntegrationGit_Files_CommitAuthor(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "commit-author"
	_, local := helper.CreateGitRepo(t, repoName, nil, "write")

	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "dashboard.json").
		Param("message", "Create dashboard.json").
		Body(common.DashboardJSON("commit-author-dash", "Commit Author", 1)).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result.Error(), "should create file")

	admin := helper.Org1.Admin
	expected := fmt.Sprintf("%s <%s>", admin.Identity.GetName(), admin.Identity.GetEmail())
	require.Equal(t, expected, common.LatestCommitAuthor(t, local, "main"))
}
