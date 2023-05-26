package git_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/go-github/v45/github"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/build/git"
)

type TestLabelsService struct {
	Labels           []*github.Label
	ListLabelsError  error
	RemoveLabelError error
	AddLabelsError   error
}

func (s *TestLabelsService) ListLabelsByIssue(ctx context.Context, owner string, repo string, number int, opts *github.ListOptions) ([]*github.Label, *github.Response, error) {
	if s.ListLabelsError != nil {
		return nil, nil, s.ListLabelsError
	}

	labels := s.Labels
	if labels == nil {
		labels = []*github.Label{}
	}

	return labels, nil, nil
}

func (s *TestLabelsService) RemoveLabelForIssue(ctx context.Context, owner string, repo string, number int, label string) (*github.Response, error) {
	if s.RemoveLabelError != nil {
		return nil, s.RemoveLabelError
	}

	return &github.Response{}, nil
}

func (s *TestLabelsService) AddLabelsToIssue(ctx context.Context, owner string, repo string, number int, labels []string) ([]*github.Label, *github.Response, error) {
	if s.AddLabelsError != nil {
		return nil, nil, s.AddLabelsError
	}

	l := make([]*github.Label, len(labels))
	for i, v := range labels {
		l[i] = &github.Label{
			Name: github.String(v),
		}
	}

	return l, nil, nil
}

func TestAddLabelToPR(t *testing.T) {
	t.Run("It should add a label to a pull request", func(t *testing.T) {
		var (
			ctx    = context.Background()
			client = &TestLabelsService{}
			pr     = 20
			label  = "test-label"
		)

		require.NoError(t, git.AddLabelToPR(ctx, client, pr, label))
	})
	t.Run("It should not return an error if the label already exists", func(t *testing.T) {
		var (
			ctx    = context.Background()
			client = &TestLabelsService{
				Labels: []*github.Label{
					{
						Name: github.String("test-label"),
					},
				},
			}
			pr    = 20
			label = "test-label"
		)

		require.NoError(t, git.AddLabelToPR(ctx, client, pr, label))
	})

	t.Run("It should return an error if GitHub returns an error when listing labels", func(t *testing.T) {
		var (
			ctx             = context.Background()
			listLabelsError = errors.New("list labels error")
			client          = &TestLabelsService{
				ListLabelsError: listLabelsError,
				Labels:          []*github.Label{},
			}
			pr    = 20
			label = "test-label"
		)

		require.ErrorIs(t, git.AddLabelToPR(ctx, client, pr, label), listLabelsError)
	})

	t.Run("It should not return an error if there are existing enterprise-check labels.", func(t *testing.T) {
		var (
			ctx    = context.Background()
			client = &TestLabelsService{
				Labels: []*github.Label{
					{
						Name: github.String("enterprise-failed"),
					},
				},
			}
			pr    = 20
			label = "test-label"
		)

		require.NoError(t, git.AddLabelToPR(ctx, client, pr, label))
	})

	t.Run("It should return an error if GitHub returns an error when removing existing enterprise-check labels", func(t *testing.T) {
		var (
			ctx              = context.Background()
			removeLabelError = errors.New("remove label error")
			client           = &TestLabelsService{
				RemoveLabelError: removeLabelError,
				Labels: []*github.Label{
					{
						Name: github.String("enterprise-failed"),
					},
				},
			}
			pr    = 20
			label = "test-label"
		)

		require.ErrorIs(t, git.AddLabelToPR(ctx, client, pr, label), removeLabelError)
	})
}
