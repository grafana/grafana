package git_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/go-github/v45/github"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/build/git"
)

type TestChecksService struct {
	CreateCheckRunError error
}

func (s *TestChecksService) CreateStatus(ctx context.Context, owner, repo, ref string, status *github.RepoStatus) (*github.RepoStatus, *github.Response, error) {
	if s.CreateCheckRunError != nil {
		return nil, nil, s.CreateCheckRunError
	}

	return &github.RepoStatus{
		ID:  github.Int64(1),
		URL: status.URL,
	}, nil, nil
}

func TestCreateEnterpriseRepoStatus(t *testing.T) {
	t.Run("It should create a repo status", func(t *testing.T) {
		var (
			ctx    = context.Background()
			client = &TestChecksService{}
			link   = "http://example.com"
			sha    = "1234"
		)

		_, err := git.CreateEnterpriseStatus(ctx, client, link, sha, "success")

		require.NoError(t, err)
	})
	t.Run("It should return an error if GitHub fails to create the status", func(t *testing.T) {
		var (
			ctx              = context.Background()
			createCheckError = errors.New("create check run error")
			client           = &TestChecksService{
				CreateCheckRunError: createCheckError,
			}
			link = "http://example.com"
			sha  = "1234"
		)

		_, err := git.CreateEnterpriseStatus(ctx, client, link, sha, "success")
		require.ErrorIs(t, err, createCheckError)
	})
}
