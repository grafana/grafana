package gogit

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type dummySecret struct{}

// Decrypt implements secrets.Service.
func (d *dummySecret) Decrypt(ctx context.Context, data []byte) ([]byte, error) {
	token, ok := os.LookupEnv("gitwraptoken")
	if !ok {
		return nil, fmt.Errorf("missing token in environment")
	}
	return []byte(token), nil
}

// Encrypt implements secrets.Service.
func (d *dummySecret) Encrypt(ctx context.Context, data []byte) ([]byte, error) {
	panic("unimplemented")
}

// FIXME!! NOTE!!!!!
// This is really just a sketchpad while trying to get things working
// the test makes destructive changes to a real git repository :)
// this should be removed before committing to main (likely sooner)
// and replaced with integration tests that check the more specific results
func TestGoGitWrapper(t *testing.T) {
	_, ok := os.LookupEnv("gitwraptoken")
	if !ok {
		t.Skipf("no token found in environment")
	}

	ctx := context.Background()
	wrap, err := Clone(ctx, "testdata/clone", &v0alpha1.Repository{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "ns",
			Name:      "unit-tester",
		},
		Spec: v0alpha1.RepositorySpec{
			GitHub: &v0alpha1.GitHubRepositoryConfig{
				URL:    "https://github.com/grafana/git-ui-sync-demo",
				Branch: "ryan-test",
			},
		},
	},
		repository.CloneOptions{
			PushOnWrites:      false,
			CreateIfNotExists: true,
			Progress:          os.Stdout,
		},
		&dummySecret{},
	)
	require.NoError(t, err)

	tree, err := wrap.ReadTree(ctx, "")
	require.NoError(t, err)

	jj, err := json.MarshalIndent(tree, "", "  ")
	require.NoError(t, err)

	fmt.Printf("TREE:%s\n", string(jj))

	ctx = repository.WithAuthorSignature(ctx, repository.CommitSignature{
		Name:  "xxxxx",
		Email: "rrr@yyyy.zzz",
		When:  time.Now(),
	})

	for i := 0; i < 10; i++ {
		fname := fmt.Sprintf("deep/path/in/test_%d.txt", i)
		fmt.Printf("Write:%s\n", fname)
		err = wrap.Write(ctx, fname, "", []byte(fmt.Sprintf("body/%d %s", i, time.Now())), "the commit message")
		require.NoError(t, err)
	}

	fmt.Printf("push...\n")
	err = wrap.Push(ctx, repository.PushOptions{
		Timeout:  10,
		Progress: os.Stdout,
	})
	require.NoError(t, err)
}

func TestReadTree(t *testing.T) {
	dir := t.TempDir()
	gitRepo, err := git.PlainInit(dir, false)
	require.NoError(t, err, "failed to init a new git repository")
	worktree, err := gitRepo.Worktree()
	require.NoError(t, err, "failed to get worktree")

	repo := &GoGitRepo{
		config: &v0alpha1.Repository{
			ObjectMeta: v1.ObjectMeta{
				Name:      "test",
				Namespace: "default",
			},
			Spec: v0alpha1.RepositorySpec{
				Title:     "test",
				Workflows: []v0alpha1.Workflow{v0alpha1.WriteWorkflow},
				Type:      v0alpha1.GitHubRepositoryType,
				GitHub: &v0alpha1.GitHubRepositoryConfig{
					URL:    "https://github.com/grafana/__unit-test",
					Path:   "grafana/",
					Branch: "main",
				},
			},
			Status: v0alpha1.RepositoryStatus{},
		},
		decryptedPassword: "password",

		repo: gitRepo,
		tree: worktree,
		dir:  dir,
	}

	err = os.WriteFile(filepath.Join(dir, "test.txt"), []byte("test"), 0644)
	require.NoError(t, err, "failed to write test file")

	err = os.Mkdir(filepath.Join(dir, "grafana"), 0750)
	require.NoError(t, err, "failed to mkdir grafana")

	err = os.WriteFile(filepath.Join(dir, "grafana", "test2.txt"), []byte("test"), 0644)
	require.NoError(t, err, "failed to write grafana/test2 file")

	ctx := context.Background()
	entries, err := repo.ReadTree(ctx, "HEAD")
	require.NoError(t, err, "failed to read tree")

	// Here is the meat of why this test exists: the ReadTree call should only read the config.Spec.GitHub.Path files.
	// All prefixes are removed (i.e. a file is just its name, not ${Path}/${Name}).
	// And it does not include the directory in the listing, as it pretends to be the root.
	require.Len(t, entries, 1, "entries from ReadTree")
	require.Equal(t, entries[0].Path, "test2.txt", "entry path")
}
