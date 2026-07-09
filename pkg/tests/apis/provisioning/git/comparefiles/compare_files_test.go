package comparefiles

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/nanogit/gittest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationCompareFiles_MergeRef reproduces the scenario where the base
// branch advances past a pull request's fork point: diffing base against the
// head ref bleeds the unrelated base change into the result, while diffing
// against a merge ref (as providers expose via refs/pull/<n>/merge) contains
// only the pull request's own change. Gitea refuses pushes to refs/pull/*, so
// the merge commit is published under refs/preview/ instead.
func TestIntegrationCompareFiles_MergeRef(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	server, err := gittest.NewServer(ctx, gittest.WithLogger(gittest.NewTestLogger(t)))
	require.NoError(t, err, "failed to start git server")
	t.Cleanup(func() {
		if err := server.Cleanup(); err != nil {
			t.Logf("failed to cleanup git server: %v", err)
		}
	})

	user, err := server.CreateUser(ctx)
	require.NoError(t, err, "failed to create user")
	remote, err := server.CreateRepo(ctx, "compare-files", user)
	require.NoError(t, err, "failed to create repo")

	local, err := gittest.NewLocalRepo(ctx)
	require.NoError(t, err, "failed to create local repo")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	require.NoError(t, local.CreateFile("dashboard-a.json", `{"title":"A"}`))
	mustGit(t, local, "add", ".")
	mustGit(t, local, "commit", "-m", "add dashboard A")
	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to init remote")
	mustGit(t, local, "push", "-u", "origin", "main")

	// Pull request branch touches only dashboard A.
	mustGit(t, local, "checkout", "-b", "feature")
	require.NoError(t, local.UpdateFile("dashboard-a.json", `{"title":"A v2"}`))
	mustGit(t, local, "add", "dashboard-a.json")
	mustGit(t, local, "commit", "-m", "update dashboard A")
	mustGit(t, local, "push", "-u", "origin", "feature")

	// Base branch advances past the fork point with an unrelated change.
	mustGit(t, local, "checkout", "main")
	require.NoError(t, local.CreateFile("dashboard-b.json", `{"title":"B"}`))
	mustGit(t, local, "add", "dashboard-b.json")
	mustGit(t, local, "commit", "-m", "add dashboard B")
	mustGit(t, local, "push", "origin", "main")

	mustGit(t, local, "checkout", "--detach", "main")
	mustGit(t, local, "merge", "feature", "-m", "merge feature")
	mustGit(t, local, "push", "origin", "HEAD:refs/preview/1/merge")

	repo, err := git.NewRepository(ctx, &provisioning.Repository{
		Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType},
	}, git.RepositoryConfig{
		URL:       remote.URL,
		Branch:    "main",
		TokenUser: user.Username,
		Token:     common.RawSecureValue(user.Password),
	})
	require.NoError(t, err, "failed to create git repository")

	changes, err := repo.CompareFiles(ctx, "main", "feature")
	require.NoError(t, err)
	require.Contains(t, changedPaths(changes), "dashboard-b.json", "head ref diff should bleed the unrelated base change")

	changes, err = repo.CompareFiles(ctx, "main", "refs/preview/1/merge", "feature")
	require.NoError(t, err)
	require.Equal(t, []string{"dashboard-a.json"}, changedPaths(changes), "merge ref diff should only contain the pull request change")
}

func changedPaths(changes []repository.VersionedFileChange) []string {
	paths := make([]string, 0, len(changes))
	for _, change := range changes {
		paths = append(paths, change.Path)
	}
	return paths
}

func mustGit(t *testing.T, local *gittest.LocalRepo, args ...string) {
	t.Helper()
	out, err := local.Git(args...)
	require.NoError(t, err, "git %v: %s", args, out)
}
