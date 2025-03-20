package gogit

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

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
	wrap, err := Clone(ctx, &v0alpha1.Repository{
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
		GoGitCloneOptions{
			Root: "testdata/clone", // where things are cloned,
			// one commit (not 11)
			SingleCommitBeforePush: true,
			CreateIfNotExists:      true,
		},
		&dummySecret{},
		os.Stdout)
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
	err = wrap.Push(ctx, GoGitPushOptions{
		Timeout: 10,
	}, os.Stdout)
	require.NoError(t, err)
}
