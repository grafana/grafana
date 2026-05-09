package github

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/go-github/v82/github"
	"github.com/grafana/grafana-app-sdk/logging"
	repo "github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

type githubClient struct {
	gh *github.Client
}

func NewClient(client *github.Client) Client {
	return &githubClient{client}
}

// translateGitHubError converts GitHub API errors into common repository errors
// For "expired" errors, it returns a more descriptive wrapped error
func translateGitHubError(err error) error {
	if err == nil {
		return nil
	}

	var ghErr *github.ErrorResponse
	if !errors.As(err, &ghErr) {
		// Not a GitHub API error, return as-is
		return err
	}

	// Extract GitHub's error message for context
	ghMessage := ghErr.Message
	statusCode := ghErr.Response.StatusCode

	// Map to common repository errors
	switch statusCode {
	case http.StatusUnauthorized:
		// 401 - Authentication failed
		// Special case: "expired" is cryptic, so add helpful context
		if strings.Contains(strings.ToLower(ghMessage), "expired") {
			return fmt.Errorf("authentication token has expired: %w", repo.ErrUnauthorized)
		}
		return repo.ErrUnauthorized

	case http.StatusForbidden:
		// 403 - Permission denied
		// Special case: rate limit gets additional context
		if strings.Contains(strings.ToLower(ghMessage), "rate limit") {
			return fmt.Errorf("API rate limit exceeded: %w", repo.ErrPermissionDenied)
		}
		return repo.ErrPermissionDenied

	case http.StatusNotFound:
		// 404 - Resource not found
		return repo.ErrFileNotFound

	case http.StatusServiceUnavailable, http.StatusBadGateway, http.StatusGatewayTimeout:
		// 503, 502, 504 - Service unavailable
		return repo.ErrServerUnavailable

	default:
		// Other errors - return with GitHub message context
		return fmt.Errorf("GitHub API error (HTTP %d: %s)", statusCode, ghMessage)
	}
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

		// Return custom errors for common cases
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) {
			switch ghErr.Response.StatusCode {
			case http.StatusUnauthorized:
				return nil, repo.ErrUnauthorized
			case http.StatusForbidden:
				// User lacks admin permissions to view branch protection.
				// Skip check gracefully - if protection rules block pushes, they'll find out at push time.
				logging.FromContext(ctx).Warn("Skipping branch protection check: token lacks Administration read permission",
					slog.String("owner", owner),
					slog.String("repository", repository),
					slog.String("branch", branch))
				return nil, nil
			case http.StatusNotFound:
				return nil, repo.ErrFileNotFound
			case http.StatusServiceUnavailable:
				return nil, repo.ErrServerUnavailable
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
	// Create logger with base context
	logger := logging.FromContext(ctx).With(
		slog.String("owner", owner),
		slog.String("repository", repository),
		slog.String("branch", branch))

	// Get all active rules that apply to this specific branch
	// This API returns only active rules (no disabled/evaluate enforcement)
	branchRules, _, err := r.gh.Repositories.GetRulesForBranch(ctx, owner, repository, branch, nil)
	if err != nil {
		// Handle common error cases
		var ghErr *github.ErrorResponse
		if errors.As(err, &ghErr) {
			switch ghErr.Response.StatusCode {
			case http.StatusUnauthorized:
				return nil, repo.ErrUnauthorized
			case http.StatusForbidden:
				// User lacks permissions to view rules (though Metadata read should be enough).
				// Skip check gracefully.
				logger.Warn("Skipping ruleset check: insufficient permissions")
				return nil, nil
			case http.StatusNotFound:
				return nil, repo.ErrFileNotFound
			case http.StatusServiceUnavailable:
				return nil, repo.ErrServerUnavailable
			}
		}

		return nil, fmt.Errorf("failed to get rules for branch: %w", err)
	}

	// No rules apply to this branch
	if branchRules == nil {
		logger.Debug("No rules configured for branch")
		return nil, nil
	}

	// Only pull_request rules actually block direct pushes.
	// Other rules like non_fast_forward (blocks force push only),
	// required_status_checks (checks run after push), etc. do not prevent regular git push operations.
	if len(branchRules.PullRequest) == 0 {
		logger.Debug("No blocking rules found for branch")
		return nil, nil
	}

	// bypass_actors live on the parent ruleset, not on the per-branch rule entries.
	// We must fetch each unique parent to know whether the current actor (e.g. the
	// GitHub App installation token in use) can bypass the PR requirement; GitHub
	// evaluates that for us and returns it as `current_user_can_bypass`, so we don't
	// need to know the App's installation ID to match against bypass_actors.
	rulesetIDs := make(map[int64]struct{}, len(branchRules.PullRequest))
	for _, rule := range branchRules.PullRequest {
		if rule == nil {
			continue
		}
		if rule.RulesetID == 0 {
			// Without a valid ID we can't fetch the parent to confirm bypass — keep blocking.
			logger.Warn("Pull request rule has zero ruleset_id, treating as blocking")
			return &Rulesets{RequiresPullRequest: true}, nil
		}
		rulesetIDs[rule.RulesetID] = struct{}{}
	}

	for rulesetID := range rulesetIDs {
		ruleset, _, err := r.gh.Repositories.GetRuleset(ctx, owner, repository, rulesetID, false)
		if err != nil {
			// Fail-closed: a silent false negative would let the Repository save and
			// then fail every subsequent sync push with a 403. Surfacing a block at
			// setup is the safer default.
			logger.Warn("Failed to fetch parent ruleset, treating PR requirement as blocking",
				slog.Int64("ruleset_id", rulesetID),
				slog.Any("error", err))
			return &Rulesets{RequiresPullRequest: true}, nil
		}

		// Only "always" and "exempt" allow unrestricted direct push.
		// "pull_request" only bypasses during PR merge — direct push remains blocked.
		canBypass := ruleset.CurrentUserCanBypass
		if canBypass == nil ||
			(*canBypass != github.BypassModeAlways && *canBypass != github.BypassModeExempt) {
			logger.Debug("Branch requires pull request (current actor cannot bypass)",
				slog.Int64("ruleset_id", rulesetID),
				slog.Any("current_user_can_bypass", canBypass))
			return &Rulesets{RequiresPullRequest: true}, nil
		}

		logger.Debug("Ruleset PR requirement is bypassable by current actor",
			slog.Int64("ruleset_id", rulesetID),
			slog.String("bypass_mode", string(*canBypass)))
	}

	logger.Debug("All PR-requiring rulesets are bypassable by current actor")
	return nil, nil
}

func (r *githubClient) GetRepository(ctx context.Context, owner, repository string) (Repository, error) {
	repo, _, err := r.gh.Repositories.Get(ctx, owner, repository)
	if err != nil {
		return Repository{}, translateGitHubError(err)
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
	if errors.Is(err, repo.ErrTooManyItems) {
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
	if errors.Is(err, repo.ErrTooManyItems) {
		return nil, fmt.Errorf("too many webhooks configured (more than %d)", maxWebhooks)
	}
	if err != nil {
		return nil, translateGitHubError(err)
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
	if err != nil {
		return WebhookConfig{}, translateGitHubError(err)
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
		return WebhookConfig{}, translateGitHubError(err)
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
	if err != nil {
		return translateGitHubError(err)
	}
	return nil
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
	if err != nil {
		return translateGitHubError(err)
	}
	return nil
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
	if errors.Is(err, repo.ErrTooManyItems) {
		return nil, fmt.Errorf("pull request contains too many files (more than %d)", maxPRFiles)
	}
	if err != nil {
		return nil, translateGitHubError(err)
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
		return translateGitHubError(err)
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
			return nil, translateGitHubError(err)
		}

		// Pre-allocate the slice if this is the first page
		if allItems == nil {
			allItems = make([]T, 0, len(items)*2) // Estimate double the first page size
		}

		allItems = append(allItems, items...)

		// Check if we've exceeded the maximum allowed items
		if len(allItems) > opts.MaxItems {
			return nil, repo.ErrTooManyItems
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
