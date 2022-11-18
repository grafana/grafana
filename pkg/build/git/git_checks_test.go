package git_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/go-github/v45/github"
	"github.com/grafana/grafana/pkg/build/git"
	"github.com/stretchr/testify/require"
)

type TestChecksService struct {
	CreateCheckRunError error
}

func (s *TestChecksService) CreateCheckRun(ctx context.Context, owner, repo string, opts github.CreateCheckRunOptions) (*github.CheckRun, *github.Response, error) {
	if s.CreateCheckRunError != nil {
		return nil, nil, s.CreateCheckRunError
	}

	return &github.CheckRun{
		ID:         github.Int64(1),
		Name:       github.String(opts.Name),
		ExternalID: opts.ExternalID,
		DetailsURL: opts.DetailsURL,
	}, nil, nil
}

func (s *TestChecksService) GetCheckRun(ctx context.Context, owner, repo string, id int64) (*github.CheckRun, *github.Response, error) {
	if s.CreateCheckRunError != nil {
		return nil, nil, s.CreateCheckRunError
	}

	return &github.CheckRun{
		ID: github.Int64(id),
	}, nil, nil
}

func (s *TestChecksService) UpdateCheckRun(ctx context.Context, owner, repo string, id int64, opts github.UpdateCheckRunOptions) (*github.CheckRun, *github.Response, error) {
	if s.CreateCheckRunError != nil {
		return nil, nil, s.CreateCheckRunError
	}

	return &github.CheckRun{
		ID:         github.Int64(1),
		Name:       github.String(opts.Name),
		ExternalID: opts.ExternalID,
		DetailsURL: opts.DetailsURL,
	}, nil, nil
}

func TestCreateEnterpriseBuildCheck(t *testing.T) {
	t.Run("It should create a build check", func(t *testing.T) {
		var (
			ctx    = context.Background()
			client = &TestChecksService{}
			link   = "http://example.com"
			sha    = "1234"
		)

		run, err := git.CreateEnterpriseBuildCheck(ctx, client, link, sha)

		require.NotNil(t, run)
		require.NoError(t, err)
	})
	t.Run("It should return an error if GitHub fails to create the CheckRun", func(t *testing.T) {
		var (
			ctx              = context.Background()
			createCheckError = errors.New("create check run error")
			client           = &TestChecksService{
				CreateCheckRunError: createCheckError,
			}
			link = "http://example.com"
			sha  = "1234"
		)

		run, err := git.CreateEnterpriseBuildCheck(ctx, client, link, sha)

		require.Nil(t, run)
		require.ErrorIs(t, err, createCheckError)
	})
}
