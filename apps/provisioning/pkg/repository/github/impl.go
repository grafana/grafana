package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/go-github/v70/github"
)

type githubClient struct {
	gh *github.Client
}

func NewClient(client *github.Client) Client {
	return &githubClient{client}
}

const (
	maxCommits  = 1000 // Maximum number of commits to fetch
	maxWebhooks = 100  // Maximum number of webhooks allowed per repository
	maxPRFiles  = 1000 // Maximum number of files allowed in a pull request
)

// Commits returns a list of commits for a given repository and branch.
func (r *githubClient) Commits(ctx context.Context, owner, repository, path, branch string) ([]Commit, error) {
	listFn := func(ctx context.Context, opts *github.ListOptions) ([]*github.RepositoryCommit, *github.Response, error) {
		return r.gh.Repositories.ListCommits(ctx, owner, repository, &github.CommitsListOptions{
			Path:        path,
			SHA:         branch,
			ListOptions: *opts,
		})
	}

	commits, err := paginatedList(
		ctx,
		listFn,
		defaultListOptions(maxCommits),
	)
	if errors.Is(err, ErrTooManyItems) {
		return nil, fmt.Errorf("too many commits to fetch (more than %d)", maxCommits)
	}
	if err != nil {
		return nil, err
	}

	ret := make([]Commit, 0, len(commits))
	for _, c := range commits {
		// FIXME: This code is a mess. I am pretty sure that we have issue in
		// some situations
		var createdAt time.Time
		var author *CommitAuthor
		if c.GetCommit().GetAuthor() != nil {
			author = &CommitAuthor{
				Name:      c.GetCommit().GetAuthor().GetName(),
				Username:  c.GetAuthor().GetLogin(),
				AvatarURL: c.GetAuthor().GetAvatarURL(),
			}

			createdAt = c.GetCommit().GetAuthor().GetDate().Time
		}

		var committer *CommitAuthor
		if c.GetCommitter() != nil {
			committer = &CommitAuthor{
				Name:      c.GetCommit().GetCommitter().GetName(),
				Username:  c.GetCommitter().GetLogin(),
				AvatarURL: c.GetCommitter().GetAvatarURL(),
			}
		}

		ret = append(ret, Commit{
			Ref:       c.GetSHA(),
			Message:   c.GetCommit().GetMessage(),
			Author:    author,
			Committer: committer,
			CreatedAt: createdAt,
		})
	}

	return ret, nil
}

func (r *githubClient) ListWebhooks(ctx context.Context, owner, repository string) ([]WebhookConfig, error) {
	listFn := func(ctx context.Context, opts *github.ListOptions) ([]*github.Hook, *github.Response, error) {
		return r.gh.Repositories.ListHooks(ctx, owner, repository, opts)
	}

	hooks, err := paginatedList(
		ctx,
		listFn,
		defaultListOptions(maxWebhooks),
	)
	if errors.Is(err, ErrTooManyItems) {
		return nil, fmt.Errorf("too many webhooks configured (more than %d)", maxWebhooks)
	}
	if err != nil {
		return nil, err
	}

	// Pre-allocate the result slice
	ret := make([]WebhookConfig, 0, len(hooks))
	for _, h := range hooks {
		contentType := h.GetConfig().GetContentType()
		if contentType == "" {
			contentType = "form"
		}

		ret = append(ret, WebhookConfig{
			ID:          h.GetID(),
			Events:      h.Events,
			Active:      h.GetActive(),
			URL:         h.GetConfig().GetURL(),
			ContentType: contentType,
			// Intentionally not setting Secret.
		})
	}
	return ret, nil
}

func (r *githubClient) CreateWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) (WebhookConfig, error) {
	if cfg.ContentType == "" {
		cfg.ContentType = "form"
	}

	hook := &github.Hook{
		URL:    &cfg.URL,
		Events: cfg.Events,
		Active: &cfg.Active,
		Config: &github.HookConfig{
			ContentType: &cfg.ContentType,
			Secret:      &cfg.Secret,
			URL:         &cfg.URL,
		},
	}

	createdHook, _, err := r.gh.Repositories.CreateHook(ctx, owner, repository, hook)
	var ghErr *github.ErrorResponse
	if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return WebhookConfig{}, ErrServiceUnavailable
	}
	if err != nil {
		return WebhookConfig{}, err
	}

	return WebhookConfig{
		ID: createdHook.GetID(),
		// events is not returned by GitHub.
		Events:      cfg.Events,
		Active:      createdHook.GetActive(),
		URL:         createdHook.GetConfig().GetURL(),
		ContentType: createdHook.GetConfig().GetContentType(),
		// Secret is not returned by GitHub.
		Secret: cfg.Secret,
	}, nil
}

func (r *githubClient) GetWebhook(ctx context.Context, owner, repository string, webhookID int64) (WebhookConfig, error) {
	hook, _, err := r.gh.Repositories.GetHook(ctx, owner, repository, webhookID)
	if err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return WebhookConfig{}, ErrServiceUnavailable
		}
		if ghErr.Response.StatusCode == http.StatusNotFound {
			return WebhookConfig{}, ErrResourceNotFound
		}
		return WebhookConfig{}, err
	}

	contentType := hook.GetConfig().GetContentType()
	if contentType == "" {
		// FIXME: Not sure about the value of the contentType
		// we default to form in the other ones but to JSON here
		contentType = "json"
	}

	return WebhookConfig{
		ID:          hook.GetID(),
		Events:      hook.Events,
		Active:      hook.GetActive(),
		URL:         hook.GetConfig().GetURL(),
		ContentType: contentType,
		// Intentionally not setting Secret.
	}, nil
}

func (r *githubClient) DeleteWebhook(ctx context.Context, owner, repository string, webhookID int64) error {
	_, err := r.gh.Repositories.DeleteHook(ctx, owner, repository, webhookID)
	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		return err
	}
	if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	if ghErr.Response.StatusCode == http.StatusNotFound {
		return ErrResourceNotFound
	}
	return err
}

func (r *githubClient) EditWebhook(ctx context.Context, owner, repository string, cfg WebhookConfig) error {
	if cfg.ContentType == "" {
		cfg.ContentType = "form"
	}

	hook := &github.Hook{
		URL:    &cfg.URL,
		Events: cfg.Events,
		Active: &cfg.Active,
		Config: &github.HookConfig{
			ContentType: &cfg.ContentType,
			Secret:      &cfg.Secret,
			URL:         &cfg.URL,
		},
	}
	_, _, err := r.gh.Repositories.EditHook(ctx, owner, repository, cfg.ID, hook)
	var ghErr *github.ErrorResponse
	if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	return err
}

func (r *githubClient) ListPullRequestFiles(ctx context.Context, owner, repository string, number int) ([]CommitFile, error) {
	listFn := func(ctx context.Context, opts *github.ListOptions) ([]*github.CommitFile, *github.Response, error) {
		return r.gh.PullRequests.ListFiles(ctx, owner, repository, number, opts)
	}

	files, err := paginatedList(
		ctx,
		listFn,
		defaultListOptions(maxPRFiles),
	)
	if errors.Is(err, ErrTooManyItems) {
		return nil, fmt.Errorf("pull request contains too many files (more than %d)", maxPRFiles)
	}
	if err != nil {
		return nil, err
	}

	// Convert to the interface type
	ret := make([]CommitFile, 0, len(files))
	for _, f := range files {
		ret = append(ret, f)
	}

	return ret, nil
}

func (r *githubClient) CreatePullRequestComment(ctx context.Context, owner, repository string, number int, body string) error {
	comment := &github.IssueComment{
		Body: &body,
	}

	if _, _, err := r.gh.Issues.CreateComment(ctx, owner, repository, number, comment); err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) && ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return ErrServiceUnavailable
		}
		return err
	}

	return nil
}

// listOptions represents pagination parameters for list operations
type listOptions struct {
	github.ListOptions
	MaxItems int
}

// defaultListOptions returns a ListOptions with sensible defaults
func defaultListOptions(maxItems int) listOptions {
	return listOptions{
		ListOptions: github.ListOptions{
			Page:    1,
			PerPage: 100,
		},
		MaxItems: maxItems,
	}
}

// paginatedList is a generic function to handle GitHub API pagination
func paginatedList[T any](
	ctx context.Context,
	listFn func(context.Context, *github.ListOptions) ([]T, *github.Response, error),
	opts listOptions,
) ([]T, error) {
	var allItems []T

	for {
		items, resp, err := listFn(ctx, &opts.ListOptions)
		if err != nil {
			var ghErr *github.ErrorResponse
			if !errors.As(err, &ghErr) {
				return nil, err
			}
			if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
				return nil, ErrServiceUnavailable
			}
			if ghErr.Response.StatusCode == http.StatusNotFound {
				return nil, ErrResourceNotFound
			}
			return nil, err
		}

		// Pre-allocate the slice if this is the first page
		if allItems == nil {
			allItems = make([]T, 0, len(items)*2) // Estimate double the first page size
		}

		allItems = append(allItems, items...)

		// Check if we've exceeded the maximum allowed items
		if len(allItems) > opts.MaxItems {
			return nil, ErrTooManyItems
		}

		// If there are no more pages, break
		if resp.NextPage == 0 {
			break
		}

		// Set up next page
		opts.Page = resp.NextPage
	}

	return allItems, nil
}
