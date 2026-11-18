package repository

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/nanogit/gittest"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/local"
	apicommon "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationRepository_HiddenPathContract(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	server, err := gittest.NewServer(t.Context(), gittest.WithLogger(gittest.NewTestLogger(t)))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, server.Cleanup()) })
	user, err := server.CreateUser(t.Context())
	require.NoError(t, err)

	for i, prefix := range []string{"", "configs/", ".configured/"} {
		t.Run(fmt.Sprintf("root-%d", i), func(t *testing.T) {
			remote, err := server.CreateRepo(t.Context(), fmt.Sprintf("hidden-paths-%d", i), user)
			require.NoError(t, err)
			checkout, err := gittest.NewLocalRepo(t.Context())
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, checkout.Cleanup()) })
			_, err = checkout.InitWithRemote(user, remote)
			require.NoError(t, err)
			base, err := checkout.Git("rev-parse", "HEAD")
			require.NoError(t, err)
			_, err = checkout.Git("rm", "test.txt")
			require.NoError(t, err)

			for _, path := range []string{
				"dashboard.json", "team/dashboard.json", "team/.keep", "team.v2/dashboard.json", "empty/.keep",
				".config.json", ".ci/pipeline.yaml", ".ci/_folder.json", ".ci/.keep", ".github/workflows/lint.yml",
				"team/.ci/config.json", "team/.hidden & config/_folder.json", ".keep/dashboard.json",
			} {
				require.NoError(t, checkout.CreateFile(prefix+path, "content"))
			}
			_, err = checkout.Git("add", ".")
			require.NoError(t, err)
			_, err = checkout.Git("commit", "-m", "Add hidden and visible paths")
			require.NoError(t, err)
			_, err = checkout.Git("push")
			require.NoError(t, err)

			gitRepo, err := git.NewRepository(t.Context(), &provisioning.Repository{
				Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType},
			}, git.RepositoryConfig{
				URL: remote.URL, Branch: "main", Path: prefix, TokenUser: user.Username, Token: apicommon.RawSecureValue(user.Password),
			}, nil, nil)
			require.NoError(t, err)
			githubRepo, err := github.NewRepository(t.Context(), &provisioning.Repository{
				Spec: provisioning.RepositorySpec{Type: provisioning.GitHubRepositoryType},
			}, gitRepo, github.ProvideFactory(), "")
			require.NoError(t, err)
			stagedRepo, err := gitRepo.Stage(t.Context(), repository.StageOptions{})
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, stagedRepo.Remove(t.Context())) })
			localRepo := local.NewRepository(&provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:  provisioning.LocalRepositoryType,
					Local: &provisioning.LocalRepositoryConfig{Path: filepath.Join(checkout.Path, prefix)},
				},
			}, &local.LocalFolderResolver{PermittedPrefixes: []string{checkout.Path}}, nil)

			want := []repository.FileTreeEntry{
				{Path: "dashboard.json", Blob: true},
				{Path: "team/"}, {Path: "team/dashboard.json", Blob: true}, {Path: "team/.keep", Blob: true},
				{Path: "team.v2/"}, {Path: "team.v2/dashboard.json", Blob: true},
				{Path: "empty/"}, {Path: "empty/.keep", Blob: true},
			}
			for name, reader := range map[string]repository.Reader{
				"git": gitRepo, "github": githubRepo, "staged": stagedRepo, "local": localRepo,
			} {
				t.Run(name, func(t *testing.T) {
					entries, err := reader.ReadTree(t.Context(), "")
					require.NoError(t, err)
					for i := range entries {
						entries[i].Hash = ""
						entries[i].Size = 0
					}
					require.ElementsMatch(t, want, entries)

					if versioned, ok := reader.(repository.Versioned); ok {
						changes, err := versioned.CompareFiles(t.Context(), strings.TrimSpace(base), "main")
						require.NoError(t, err)
						wantPaths := make([]string, 0, len(want)+1)
						for _, entry := range want {
							wantPaths = append(wantPaths, strings.TrimSuffix(entry.Path, "/"))
						}
						if prefix == "" {
							wantPaths = append(wantPaths, "test.txt")
						}
						paths := make([]string, 0, len(changes))
						for _, change := range changes {
							paths = append(paths, strings.TrimSuffix(change.Path, "/"))
						}
						require.ElementsMatch(t, wantPaths, paths)
					}
				})
			}
		})
	}
}
