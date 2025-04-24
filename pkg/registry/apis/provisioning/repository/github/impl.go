package github

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/go-github/v70/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type githubClient struct {
	gh *github.Client
}

func NewClient(client *github.Client) Client {
	return &githubClient{client}
}

func (r *githubClient) IsAuthenticated(ctx context.Context) error {
	if _, _, err := r.gh.Users.Get(ctx, ""); err != nil {
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) {
			switch ghErr.Response.StatusCode {
			case http.StatusUnauthorized:
				return apierrors.NewUnauthorized("token is invalid or expired")
			case http.StatusForbidden:
				return &apierrors.StatusError{
					ErrStatus: metav1.Status{
						Status:  metav1.StatusFailure,
						Code:    http.StatusUnauthorized,
						Reason:  metav1.StatusReasonUnauthorized,
						Message: "token is revoked or has insufficient permissions",
					},
				}
			case http.StatusServiceUnavailable:
				return ErrServiceUnavailable
			}
		}

		return err
	}

	return nil
}

func (r *githubClient) RepoExists(ctx context.Context, owner, repository string) (bool, error) {
	_, resp, err := r.gh.Repositories.Get(ctx, owner, repository)
	if err == nil {
		return true, nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	return false, err
}

const (
	maxDirectoryItems           = 1000             // Maximum number of items allowed in a directory
	maxTreeItems                = 10000            // Maximum number of items allowed in a tree
	maxCommits                  = 1000             // Maximum number of commits to fetch
	maxCompareFiles             = 1000             // Maximum number of files to compare between commits
	maxWebhooks                 = 100              // Maximum number of webhooks allowed per repository
	maxPRFiles                  = 1000             // Maximum number of files allowed in a pull request
	maxPullRequestsFileComments = 1000             // Maximum number of comments allowed in a pull request
	maxFileSize                 = 10 * 1024 * 1024 // 10MB in bytes
)

func (r *githubClient) GetContents(ctx context.Context, owner, repository, path, ref string) (fileContents RepositoryContent, dirContents []RepositoryContent, err error) {
	// First try to get repository contents
	opts := &github.RepositoryContentGetOptions{
		Ref: ref,
	}

	fc, dc, _, err := r.gh.Repositories.GetContents(ctx, owner, repository, path, opts)
	if err != nil {
		var ghErr *github.ErrorResponse
		if !errors.As(err, &ghErr) {
			return nil, nil, err
		}
		if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return nil, nil, ErrServiceUnavailable
		}
		if ghErr.Response.StatusCode == http.StatusNotFound {
			return nil, nil, ErrResourceNotFound
		}
		return nil, nil, err
	}

	if fc != nil {
		// Check file size before returning content
		if fc.GetSize() > maxFileSize {
			return nil, nil, ErrFileTooLarge
		}
		return realRepositoryContent{fc}, nil, nil
	}

	// For directories, check size limits
	if len(dc) > maxDirectoryItems {
		return nil, nil, fmt.Errorf("directory contains too many items (more than %d)", maxDirectoryItems)
	}

	// Convert directory contents
	allContents := make([]RepositoryContent, 0, len(dc))
	for _, original := range dc {
		allContents = append(allContents, realRepositoryContent{original})
	}

	return nil, allContents, nil
}

func (r *githubClient) GetTree(ctx context.Context, owner, repository, basePath, ref string, recursive bool) ([]RepositoryContent, bool, error) {
	var tree *github.Tree
	var err error

	subPaths := safepath.Split(basePath)
	currentRef := ref

	for {
		// If subPaths is empty, we can read recursively, as we're reading the tree from the "base" of the repository. Otherwise, always read only the direct children.
		recursive := recursive && len(subPaths) == 0

		tree, _, err = r.gh.Git.GetTree(ctx, owner, repository, currentRef, recursive)
		if err != nil {
			var ghErr *github.ErrorResponse
			if !errors.As(err, &ghErr) {
				return nil, false, err
			}
			if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
				return nil, false, ErrServiceUnavailable
			}
			if ghErr.Response.StatusCode == http.StatusNotFound {
				if currentRef != ref {
					// We're operating with a subpath which doesn't exist yet.
					// Pretend as if there is simply no files.
					// FIXME: why should we pretend this?
					return nil, false, nil
				}
				// currentRef == ref
				// This indicates the repository or commitish reference doesn't exist. This should always return an error.
				return nil, false, ErrResourceNotFound
			}
			return nil, false, err
		}

		// Check if we've exceeded the maximum allowed items
		if len(tree.Entries) > maxTreeItems {
			return nil, false, fmt.Errorf("tree contains too many items (more than %d)", maxTreeItems)
		}

		// Prep for next iteration.
		if len(subPaths) == 0 {
			// We're done: we've discovered the tree we want.
			break
		}

		// the ref must be equal the SHA of the entry corresponding to subPaths[0]
		currentRef = ""
		for _, e := range tree.Entries {
			if e.GetPath() == subPaths[0] {
				currentRef = e.GetSHA()
				break
			}
		}
		subPaths = subPaths[1:]
		if currentRef == "" {
			// We couldn't find the folder in the tree...
			return nil, false, nil
		}
	}

	// If the tree is truncated and we're in recursive mode, return an error
	if tree.GetTruncated() && recursive {
		return nil, true, fmt.Errorf("tree is too large to fetch recursively (more than %d items)", maxTreeItems)
	}

	entries := make([]RepositoryContent, 0, len(tree.Entries))
	for _, te := range tree.Entries {
		rrc := &realRepositoryContent{
			real: &github.RepositoryContent{
				Path: te.Path,
				Size: te.Size,
				SHA:  te.SHA,
			},
		}
		if te.GetType() == "tree" {
			rrc.real.Type = github.Ptr("dir")
		} else {
			rrc.real.Type = te.Type
		}
		entries = append(entries, rrc)
	}
	return entries, tree.GetTruncated(), nil
}

func (r *githubClient) CreateFile(ctx context.Context, owner, repository, path, branch, message string, content []byte) error {
	if message == "" {
		message = fmt.Sprintf("Create %s", path)
	}

	_, _, err := r.gh.Repositories.CreateFile(ctx, owner, repository, path, &github.RepositoryContentFileOptions{
		Branch:  &branch,
		Message: &message,
		Content: content,
	})
	if err == nil {
		return nil
	}

	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		return err
	}
	if ghErr.Response.StatusCode == http.StatusUnprocessableEntity {
		return ErrResourceAlreadyExists
	}
	return err
}

func (r *githubClient) UpdateFile(ctx context.Context, owner, repository, path, branch, message, hash string, content []byte) error {
	if message == "" {
		message = fmt.Sprintf("Update %s", path)
	}

	_, _, err := r.gh.Repositories.UpdateFile(ctx, owner, repository, path, &github.RepositoryContentFileOptions{
		Branch:  &branch,
		Message: &message,
		Content: content,
		SHA:     &hash,
	})
	if err == nil {
		return nil
	}

	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		return err
	}
	if ghErr.Response.StatusCode == http.StatusNotFound {
		return ErrResourceNotFound
	}
	if ghErr.Response.StatusCode == http.StatusConflict {
		return ErrMismatchedHash
	}
	if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	return err
}

func (r *githubClient) DeleteFile(ctx context.Context, owner, repository, path, branch, message, hash string) error {
	if message == "" {
		message = fmt.Sprintf("Delete %s", path)
	}

	_, _, err := r.gh.Repositories.DeleteFile(ctx, owner, repository, path, &github.RepositoryContentFileOptions{
		Branch:  &branch,
		Message: &message,
		SHA:     &hash,
	})
	if err == nil {
		return nil
	}

	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		return err
	}
	if ghErr.Response.StatusCode == http.StatusNotFound {
		return ErrResourceNotFound
	}
	if ghErr.Response.StatusCode == http.StatusConflict {
		return ErrMismatchedHash
	}
	if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
		return ErrServiceUnavailable
	}
	return err
}

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

func (r *githubClient) CompareCommits(ctx context.Context, owner, repository, base, head string) ([]CommitFile, error) {
	listFn := func(ctx context.Context, opts *github.ListOptions) ([]*github.CommitFile, *github.Response, error) {
		compare, resp, err := r.gh.Repositories.CompareCommits(ctx, owner, repository, base, head, opts)
		if err != nil {
			return nil, resp, err
		}
		return compare.Files, resp, nil
	}

	files, err := paginatedList(
		ctx,
		listFn,
		defaultListOptions(maxCompareFiles),
	)
	if errors.Is(err, ErrTooManyItems) {
		return nil, fmt.Errorf("too many files changed between commits (more than %d)", maxCompareFiles)
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

func (r *githubClient) GetBranch(ctx context.Context, owner, repository, branchName string) (Branch, error) {
	branch, resp, err := r.gh.Repositories.GetBranch(ctx, owner, repository, branchName, 0)
	if err != nil {
		// For some reason, GitHub client handles this case differently by failing with a wrapped error
		if resp != nil && resp.StatusCode == http.StatusNotFound {
			return Branch{}, ErrResourceNotFound
		}

		if resp != nil && resp.StatusCode == http.StatusServiceUnavailable {
			return Branch{}, ErrServiceUnavailable
		}

		var ghErr *github.ErrorResponse
		if !errors.As(err, &ghErr) {
			return Branch{}, err
		}
		// Leaving these just in case
		if ghErr.Response.StatusCode == http.StatusServiceUnavailable {
			return Branch{}, ErrServiceUnavailable
		}
		if ghErr.Response.StatusCode == http.StatusNotFound {
			return Branch{}, ErrResourceNotFound
		}
		return Branch{}, err
	}

	return Branch{
		Name: branch.GetName(),
		Sha:  branch.GetCommit().GetSHA(),
	}, nil
}

func (r *githubClient) CreateBranch(ctx context.Context, owner, repository, sourceBranch, branchName string) error {
	// Fail if the branch already exists
	if _, _, err := r.gh.Repositories.GetBranch(ctx, owner, repository, branchName, 0); err == nil {
		return ErrResourceAlreadyExists
	}

	// Branch out based on the repository branch
	baseRef, _, err := r.gh.Repositories.GetBranch(ctx, owner, repository, sourceBranch, 0)
	if err != nil {
		return fmt.Errorf("get base branch: %w", err)
	}

	if _, _, err := r.gh.Git.CreateRef(ctx, owner, repository, &github.Reference{
		Ref: github.Ptr(fmt.Sprintf("refs/heads/%s", branchName)),
		Object: &github.GitObject{
			SHA: baseRef.Commit.SHA,
		},
	}); err != nil {
		return fmt.Errorf("create branch ref: %w", err)
	}

	return nil
}

func (r *githubClient) BranchExists(ctx context.Context, owner, repository, branchName string) (bool, error) {
	_, resp, err := r.gh.Repositories.GetBranch(ctx, owner, repository, branchName, 0)
	if err == nil {
		return true, nil
	}

	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	return false, err
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

type realRepositoryContent struct {
	real *github.RepositoryContent
}

var _ RepositoryContent = realRepositoryContent{}

func (c realRepositoryContent) IsDirectory() bool {
	return c.real.GetType() == "dir"
}

func (c realRepositoryContent) GetFileContent() (string, error) {
	return c.real.GetContent()
}

func (c realRepositoryContent) IsSymlink() bool {
	return c.real.Target != nil
}

func (c realRepositoryContent) GetPath() string {
	return c.real.GetPath()
}

func (c realRepositoryContent) GetSHA() string {
	return c.real.GetSHA()
}

func (c realRepositoryContent) GetSize() int64 {
	if c.real.Size != nil {
		return int64(*c.real.Size)
	}
	if c.real.Content != nil {
		if c, err := c.real.GetContent(); err == nil {
			return int64(len(c))
		}
	}
	return 0
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
