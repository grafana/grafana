package git

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
)

func TestIntegrationGit_Files_CommitAuthor(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := t.Context()

	repoName := "commit-author"
	_, local := helper.CreateGitRepo(t, repoName, nil, "write")

	result := helper.EditorREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource("files", "dashboard.json").
		Param("message", "Create dashboard.json").
		Body(common.DashboardJSON("commit-author-dash", "Commit Author", 1)).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result.Error(), "should create file")

	editor := helper.Org1.Editor
	name, email := editor.Identity.GetName(), editor.Identity.GetEmail()
	require.NotEmpty(t, name)
	require.NotEmpty(t, email)
	require.Equal(t, fmt.Sprintf("%s <%s>", name, email), common.LatestCommitAuthor(t, local, "main"))
}
