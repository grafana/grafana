package github

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/go-github/v82/github"
	"github.com/grafana/grafana-app-sdk/logging"
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

func (r *githubClient) GetBranchProtection(ctx context.Context, owner, repository, branch string) (*BranchProtection, error) {
	protection, _, err := r.gh.Repositories.GetBranchProtection(ctx, owner, repository, branch)
	if err != nil {
		// Branch has no protection rules at all - this is fine, skip the check.
		if errors.Is(err, github.ErrBranchNotProtected) {
			return nil, nil
		}

		// Return custom errors for common cases (similar to webhook operations).
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) {
			switch ghErr.Response.StatusCode {
			case http.StatusUnauthorized:
				return nil, ErrUnauthorized
			case http.StatusForbidden:
				// User lacks admin permissions to view branch protection.
				// Skip check gracefully - if protection rules block pushes, they'll find out at push time.
				logging.FromContext(ctx).Warn("Skipping branch protection check: token lacks Administration read permission",
					slog.String("owner", owner),
					slog.String("repository", repository),
					slog.String("branch", branch))
				return nil, nil
			case http.StatusNotFound:
				return nil, ErrResourceNotFound
			case http.StatusServiceUnavailable:
				return nil, ErrServiceUnavailable
			}
		}

		return nil, fmt.Errorf("failed to get branch protection: %w", err)
	}

	bp := &BranchProtection{
		RequiredPullRequestReviews: protection.RequiredPullRequestReviews != nil,
		LockBranch:                 protection.LockBranch != nil && protection.LockBranch.GetEnabled(),
	}

	return bp, nil
}

func (r *githubClient) GetRulesets(ctx context.Context, owner, repository, branch string) (*Rulesets, error) {
	// Get all rulesets for the repository
	rulesets, _, err := r.gh.Repositories.GetAllRulesets(ctx, owner, repository, nil)
	if err != nil {
		// Handle common error cases
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) {
			switch ghErr.Response.StatusCode {
			case http.StatusUnauthorized:
				return nil, ErrUnauthorized
			case http.StatusForbidden:
				// User lacks permissions to view rulesets (though Metadata read should be enough).
				// Skip check gracefully.
				logging.FromContext(ctx).Warn("Skipping ruleset check: insufficient permissions",
					slog.String("owner", owner),
					slog.String("repository", repository),
					slog.String("branch", branch))
				return nil, nil
			case http.StatusNotFound:
				return nil, ErrResourceNotFound
			case http.StatusServiceUnavailable:
				return nil, ErrServiceUnavailable
			}
		}

		return nil, fmt.Errorf("failed to get rulesets: %w", err)
	}

	// No rulesets configured
	if len(rulesets) == 0 {
		logging.FromContext(ctx).Debug("No rulesets configured for repository",
			slog.String("owner", owner),
			slog.String("repository", repository))
		return nil, nil
	}

	logging.FromContext(ctx).Debug("Checking rulesets for branch",
		slog.String("owner", owner),
		slog.String("repository", repository),
		slog.String("branch", branch),
		slog.Int("ruleset_count", len(rulesets)))

	result := &Rulesets{}

	// Check each ruleset to see if it applies to the target branch
	for _, ruleset := range rulesets {
		rulesetName := ruleset.Name
		enforcement := string(ruleset.Enforcement)

		logging.FromContext(ctx).Debug("Evaluating ruleset",
			slog.String("ruleset_name", rulesetName),
			slog.String("enforcement", enforcement))

		// Skip disabled or evaluate-only rulesets
		if enforcement == "disabled" || enforcement == "evaluate" {
			logging.FromContext(ctx).Debug("Skipping non-active ruleset",
				slog.String("ruleset_name", rulesetName),
				slog.String("enforcement", enforcement))
			continue
		}

		// Check if this ruleset targets branches and matches our branch
		target := ruleset.GetTarget()
		if target == nil || string(*target) != "branch" {
			logging.FromContext(ctx).Debug("Skipping non-branch ruleset",
				slog.String("ruleset_name", rulesetName),
				slog.String("target", func() string {
					if target == nil {
						return "nil"
					}
					return string(*target)
				}()))
			continue
		}

		// Check if the ruleset applies to this specific branch
		if !rulesetMatchesBranch(ruleset, branch) {
			logging.FromContext(ctx).Debug("Ruleset does not match branch",
				slog.String("ruleset_name", rulesetName),
				slog.String("branch", branch))
			continue
		}

		logging.FromContext(ctx).Debug("Ruleset matches branch, checking rules",
			slog.String("ruleset_name", rulesetName),
			slog.String("branch", branch))

		// Check the rules in this ruleset
		rules := ruleset.GetRules()
		if rules != nil {
			// Check for pull request requirement
			if rules.PullRequest != nil {
				logging.FromContext(ctx).Debug("Ruleset has PullRequest rule",
					slog.String("ruleset_name", rulesetName))
				result.RequiresPullRequest = true
			}

			// Check for other blocking rules
			if rules.RequiredStatusChecks != nil || rules.RequiredSignatures != nil ||
				rules.RequiredLinearHistory != nil || rules.RequiredDeployments != nil ||
				rules.Creation != nil || rules.NonFastForward != nil {
				logging.FromContext(ctx).Debug("Ruleset has blocking rules",
					slog.String("ruleset_name", rulesetName),
					slog.Bool("RequiredStatusChecks", rules.RequiredStatusChecks != nil),
					slog.Bool("RequiredSignatures", rules.RequiredSignatures != nil),
					slog.Bool("RequiredLinearHistory", rules.RequiredLinearHistory != nil),
					slog.Bool("RequiredDeployments", rules.RequiredDeployments != nil),
					slog.Bool("Creation", rules.Creation != nil),
					slog.Bool("NonFastForward", rules.NonFastForward != nil))
				result.HasBlockingRules = true
			}
		}
	}

	// Return nil if no blocking rules found
	if !result.RequiresPullRequest && !result.HasBlockingRules {
		logging.FromContext(ctx).Debug("No blocking rulesets found for branch",
			slog.String("owner", owner),
			slog.String("repository", repository),
			slog.String("branch", branch))
		return nil, nil
	}

	logging.FromContext(ctx).Debug("Found blocking rulesets for branch",
		slog.String("owner", owner),
		slog.String("repository", repository),
		slog.String("branch", branch),
		slog.Bool("requires_pull_request", result.RequiresPullRequest),
		slog.Bool("has_blocking_rules", result.HasBlockingRules))

	return result, nil
}

// rulesetMatchesBranch checks if a ruleset's conditions match the given branch name.
func rulesetMatchesBranch(ruleset *github.RepositoryRuleset, branch string) bool {
	if ruleset.Conditions == nil || ruleset.Conditions.RefName == nil {
		// No conditions means it applies to all branches
		return true
	}

	refName := ruleset.Conditions.RefName

	// Check include patterns
	if refName.Include != nil {
		matched := false
		for _, pattern := range refName.Include {
			if matchesPattern(pattern, branch) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check exclude patterns
	if refName.Exclude != nil {
		for _, pattern := range refName.Exclude {
			if matchesPattern(pattern, branch) {
				return false
			}
		}
	}

	return true
}

// matchesPattern checks if a branch name matches a GitHub ref pattern.
// Patterns can use ~DEFAULT_BRANCH or refs/heads/ prefixes, or be simple names.
func matchesPattern(pattern, branch string) bool {
	// Handle special ~DEFAULT_BRANCH pattern (we can't check this without repo metadata)
	if pattern == "~DEFAULT_BRANCH" {
		// We'd need to compare against repo.DefaultBranch, but we don't have that here
		// For now, assume it might match (conservative approach)
		return true
	}

	// Remove refs/heads/ prefix if present in pattern
	if len(pattern) > 11 && pattern[:11] == "refs/heads/" {
		pattern = pattern[11:]
	}

	// Simple exact match (we could add fnmatch pattern matching here if needed)
	return pattern == branch
}

func (r *githubClient) GetRepository(ctx context.Context, owner, repository string) (Repository, error) {
	repo, _, err := r.gh.Repositories.Get(ctx, owner, repository)
	if err != nil {
		return Repository{}, fmt.Errorf("failed to get repository: %w", err)
	}

	return Repository{
		ID:            repo.GetID(),
		Name:          repo.GetName(),
		DefaultBranch: repo.GetDefaultBranch(),
	}, nil
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
	if ghErr.Response.StatusCode == http.StatusUnauthorized || ghErr.Response.StatusCode == http.StatusForbidden {
		return ErrUnauthorized
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
