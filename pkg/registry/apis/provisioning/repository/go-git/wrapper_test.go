package gogit

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func TestGoGitWrapper(t *testing.T) {
	wrap, err := Clone(context.Background(), &v0alpha1.Repository{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "ns",
			Name:      "unit-tester",
		},
		Spec: v0alpha1.RepositorySpec{
			GitHub: &v0alpha1.GitHubRepositoryConfig{
				Owner:      "grafana",
				Repository: "git-ui-sync-demo",
				Branch:     "ryan-test",
				Token:      "XXX",
			},
		},
	}, "ttt", os.Stdout)
	require.NoError(t, err)

	tree, err := wrap.ReadTree(context.Background(), "")
	require.NoError(t, err)

	jj, err := json.MarshalIndent(tree, "", "  ")
	require.NoError(t, err)

	fmt.Printf("TREE:%s\n", string(jj))
}
