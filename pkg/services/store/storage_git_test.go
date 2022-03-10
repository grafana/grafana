package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestGitStorage(t *testing.T) {
	ctx := context.Background()
	token := os.Getenv("GITHUB_AUTH_TOKEN")

	helper, err := newGithubHelper(ctx, "https://github.com/grafana/hackathon-2022-03-git-dash-A.git", token)
	require.NoError(t, err)
	require.Equal(t, "grafana", helper.repoOwner)
	require.Equal(t, "hackathon-2022-03-git-dash-A", helper.repoName)
	require.NotNil(t, helper)

	repo, _, err := helper.getRepo(ctx)
	require.NoError(t, err)
	require.Equal(t, "main", *repo.DefaultBranch)
	//require.Equal(t, "x", p.GetRestrictions())

	ref, _, err := helper.getRef(ctx, "main")
	require.NoError(t, err)

	fmt.Printf("V: %v\n", ref.URL)

	baseBranch := "main"
	headBranch := fmt.Sprintf("bbb_%d", time.Now().UnixMilli())

	bbb, _, err := helper.createRef(ctx, baseBranch, headBranch)
	require.NoError(t, err)
	fmt.Printf("V: %v\n", bbb.URL)

	err = helper.pushCommit(ctx, bbb, &WriteValueRequest{
		Path:    "simple.txt",
		Body:    []byte("hello world: " + headBranch),
		Message: "here is my message",
		User: &models.SignedInUser{
			Name:  "ryan",
			Email: "ryantxu@gmail.com",
		},
	})
	require.NoError(t, err)

	pr, _, err := helper.createPR(ctx, makePRCommand{
		title:      "My PR title",
		body:       "description of the pull request",
		headBranch: headBranch,
		baseBranch: baseBranch,
	})
	require.NoError(t, err)

	fmt.Printf("PR created: %s\n", pr.GetHTMLURL())

	t.Fail()
}
