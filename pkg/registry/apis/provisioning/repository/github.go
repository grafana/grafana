package repository

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/google/go-github/v66/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
)

type githubRepository struct {
	logger *slog.Logger
	config *provisioning.Repository
	gh     pgh.Client
	ignore provisioning.IgnoreFile
}

var _ Repository = (*githubRepository)(nil)

func NewGitHub(
	ctx context.Context,
	config *provisioning.Repository,
	factory pgh.ClientFactory,
) *githubRepository {
	return &githubRepository{
		config: config,
		logger: slog.Default().With("logger", "github-repository"),
		gh:     factory.New(ctx, config.Spec.GitHub.Token),
		ignore: provisioning.IncludeYamlOrJSON,
	}
}

func (r *githubRepository) Config() *provisioning.Repository {
	return r.config
}

// Validate implements provisioning.Repository.
func (r *githubRepository) Validate() (list field.ErrorList) {
	gh := r.config.Spec.GitHub
	if gh == nil {
		list = append(list, field.Required(field.NewPath("spec", "github"), "a github config is required"))
		return list
	}
	if gh.Owner == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "owner"), "a github repo owner is required"))
	}
	if gh.Repository == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "repository"), "a github repo name is required"))
	}
	if gh.Branch == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "branch"), "a github branch is required"))
	}
	if !isValidGitBranchName(gh.Branch) {
		list = append(list, field.Invalid(field.NewPath("spec", "github", "branch"), gh.Branch, "invalid branch name"))
	}
	if gh.Token == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "token"), "a github access token is required"))
	}
	if gh.GenerateDashboardPreviews && !gh.BranchWorkflow {
		list = append(list, field.Forbidden(field.NewPath("spec", "github", "token"), "to generate dashboard previews, you must activate the branch workflow"))
	}
	if gh.WebhookURL == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "webhookURL"), "a webhook URL is required"))
	}
	if gh.WebhookSecret == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "webhookSecret"), "a webhook secret is required"))
	}

	_, err := url.Parse(gh.WebhookURL)
	if err != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "github", "webhookURL"), gh.WebhookURL, "invalid URL"))
	}

	return list
}

// Test implements provisioning.Repository.
func (r *githubRepository) Test(ctx context.Context, logger *slog.Logger) (*provisioning.TestResults, error) {
	if err := r.gh.IsAuthenticated(ctx); err != nil {
		// TODO: should we return a more specific error or error code?
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors:  []string{err.Error()},
		}, nil
	}

	// FIXME: check token permissions

	ok, err := r.gh.RepoExists(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository)
	if err != nil {
		return &provisioning.TestResults{
			Code:    http.StatusInternalServerError,
			Success: false,
			Errors:  []string{err.Error()},
		}, nil
	}

	if !ok {
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors:  []string{"repository does not exist"},
		}, nil
	}

	ok, err = r.gh.BranchExists(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, r.config.Spec.GitHub.Branch)
	if err != nil {
		return &provisioning.TestResults{
			Code:    http.StatusInternalServerError,
			Success: false,
			Errors:  []string{err.Error()},
		}, nil
	}

	if !ok {
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors:  []string{"branch does not exist"},
		}, nil
	}

	return &provisioning.TestResults{
		Code:    http.StatusOK,
		Success: true,
	}, nil
}

// ReadResource implements provisioning.Repository.
func (r *githubRepository) Read(ctx context.Context, logger *slog.Logger, filePath, ref string) (*FileInfo, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository

	content, dirContent, err := r.gh.GetContents(ctx, owner, repo, filePath, ref)
	if err != nil {
		if errors.Is(err, pgh.ErrResourceNotFound) {
			return nil, &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Message: fmt.Sprintf("file not found; path=%s ref=%s", filePath, ref),
					Code:    http.StatusNotFound,
				},
			}
		}

		return nil, fmt.Errorf("get contents: %w", err)
	}
	if dirContent != nil {
		return nil, fmt.Errorf("input path was a directory")
	}

	data, err := content.GetFileContent()
	if err != nil {
		return nil, fmt.Errorf("get content: %w", err)
	}
	return &FileInfo{
		Path: filePath,
		Ref:  ref,
		Data: []byte(data),
		Hash: content.GetSHA(),
	}, nil
}

func (r *githubRepository) ReadTree(ctx context.Context, logger *slog.Logger, ref string) ([]FileTreeEntry, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository
	logger = logger.With("owner", owner, "repo", repo, "ref", ref)

	tree, truncated, err := r.gh.GetTree(ctx, owner, repo, ref, true)
	if err != nil {
		if errors.Is(err, pgh.ErrResourceNotFound) {
			return nil, &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Message: fmt.Sprintf("tree not found; ref=%s", ref),
					Code:    http.StatusNotFound,
				},
			}
		}
	}
	if truncated {
		logger.WarnContext(ctx, "tree from github was truncated")
	}

	entries := make([]FileTreeEntry, 0, len(tree))
	for _, entry := range tree {
		converted := FileTreeEntry{
			Path: entry.GetPath(),
			Size: entry.GetSize(),
			Hash: entry.GetSHA(),
			Blob: !entry.IsDirectory(),
		}
		entries = append(entries, converted)
	}
	return entries, nil
}

func (r *githubRepository) Create(ctx context.Context, logger *slog.Logger, path, ref string, data []byte, comment string) error {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

	if err := r.ensureBranchExists(ctx, ref); err != nil {
		return fmt.Errorf("create branch on create: %w", err)
	}

	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository

	err := r.gh.CreateFile(ctx, owner, repo, path, ref, comment, data)
	if errors.Is(err, pgh.ErrResourceAlreadyExists) {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Message: "file already exists",
				Code:    http.StatusConflict,
			},
		}
	}
	return err
}

func (r *githubRepository) Update(ctx context.Context, logger *slog.Logger, path, ref string, data []byte, comment string) error {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

	if err := r.ensureBranchExists(ctx, ref); err != nil {
		return fmt.Errorf("create branch on update: %w", err)
	}

	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository

	file, _, err := r.gh.GetContents(ctx, owner, repo, path, ref)
	if err != nil {
		if errors.Is(err, pgh.ErrResourceNotFound) {
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Message: "file not found",
					Code:    http.StatusNotFound,
				},
			}
		}

		return fmt.Errorf("get content before file update: %w", err)
	}

	if err := r.gh.UpdateFile(ctx, owner, repo, path, ref, comment, file.GetSHA(), data); err != nil {
		return fmt.Errorf("update file: %w", err)
	}
	return nil
}

func (r *githubRepository) Delete(ctx context.Context, logger *slog.Logger, path, ref, comment string) error {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

	if err := r.ensureBranchExists(ctx, ref); err != nil {
		return fmt.Errorf("create branch on delete: %w", err)
	}

	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository

	file, _, err := r.gh.GetContents(ctx, owner, repo, path, ref)
	if err != nil {
		if errors.Is(err, pgh.ErrResourceNotFound) {
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Message: "file not found",
					Code:    http.StatusNotFound,
				},
			}
		}
		return fmt.Errorf("finding file to delete: %w", err)
	}

	return r.gh.DeleteFile(ctx, owner, repo, path, ref, comment, file.GetSHA())
}

func (r *githubRepository) History(ctx context.Context, logger *slog.Logger, path, ref string) ([]provisioning.HistoryItem, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

	commits, err := r.gh.Commits(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, path, ref)
	if err != nil {
		if errors.Is(err, pgh.ErrResourceNotFound) {
			return nil, &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Message: "path not found",
					Code:    http.StatusNotFound,
				},
			}
		}

		return nil, fmt.Errorf("get commits: %w", err)
	}

	ret := make([]provisioning.HistoryItem, 0, len(commits))
	for _, commit := range commits {
		authors := make([]provisioning.Author, 0)
		if commit.Author != nil {
			authors = append(authors, provisioning.Author{
				Name:      commit.Author.Name,
				Username:  commit.Author.Username,
				AvatarURL: commit.Author.AvatarURL,
			})
		}

		if commit.Committer != nil && commit.Author != nil && commit.Author.Name != commit.Committer.Name {
			authors = append(authors, provisioning.Author{
				Name:      commit.Committer.Name,
				Username:  commit.Committer.Username,
				AvatarURL: commit.Committer.AvatarURL,
			})
		}

		ret = append(ret, provisioning.HistoryItem{
			Ref:       commit.Ref,
			Message:   commit.Message,
			Authors:   authors,
			CreatedAt: commit.CreatedAt.UnixNano(),
		})
	}

	return ret, nil
}

// basicGitBranchNameRegex is a regular expression to validate a git branch name
// it does not cover all cases as positive lookaheads are not supported in Go's regexp
var basicGitBranchNameRegex = regexp.MustCompile(`^[a-zA-Z0-9\-\_\/\.]+$`)

// isValidGitBranchName checks if a branch name is valid.
// It uses the following regexp `^[a-zA-Z0-9\-\_\/\.]+$` to validate the branch name with some additional checks that must satisfy the following rules:
// 1. The branch name must have at least one character and must not be empty.
// 2. The branch name cannot start with `/` or end with `/`, `.`, or whitespace.
// 3. The branch name cannot contain consecutive slashes (`//`).
// 4. The branch name cannot contain consecutive dots (`..`).
// 5. The branch name cannot contain `@{`.
// 6. The branch name cannot include the following characters: `~`, `^`, `:`, `?`, `*`, `[`, `\`, or `]`.
func isValidGitBranchName(branch string) bool {
	if !basicGitBranchNameRegex.MatchString(branch) {
		return false
	}

	// Additional checks for invalid patterns
	if strings.HasPrefix(branch, "/") || strings.HasSuffix(branch, "/") ||
		strings.HasSuffix(branch, ".") || strings.Contains(branch, "..") ||
		strings.Contains(branch, "//") || strings.HasSuffix(branch, ".lock") {
		return false
	}

	return true
}

func (r *githubRepository) ensureBranchExists(ctx context.Context, branchName string) error {
	if !isValidGitBranchName(branchName) {
		return &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Code:    http.StatusBadRequest,
				Message: "invalid branch name",
			},
		}
	}

	ok, err := r.gh.BranchExists(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, branchName)
	if err != nil {
		return fmt.Errorf("check branch exists: %w", err)
	}

	if ok {
		r.logger.InfoContext(ctx, "branch already exists", "branch", branchName)

		return nil
	}

	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository

	srcBranch := r.config.Spec.GitHub.Branch
	if err := r.gh.CreateBranch(ctx, owner, repo, srcBranch, branchName); err != nil {
		if errors.Is(err, pgh.ErrResourceAlreadyExists) {
			return &apierrors.StatusError{
				ErrStatus: metav1.Status{
					Code:    http.StatusConflict,
					Message: "branch already exists",
				},
			}
		}

		return fmt.Errorf("create branch: %w", err)
	}

	return nil
}

// Webhook implements Repository.
func (r *githubRepository) Webhook(ctx context.Context, logger *slog.Logger, req *http.Request) (*provisioning.WebhookResponse, error) {
	payload, err := github.ValidatePayload(req, []byte(r.config.Spec.GitHub.WebhookSecret))
	if err != nil {
		return nil, apierrors.NewUnauthorized("invalid signature")
	}

	return r.parseWebhook(github.WebHookType(req), payload)
}

// This method does not include context because it does delegate any more requests
func (r *githubRepository) parseWebhook(messageType string, payload []byte) (*provisioning.WebhookResponse, error) {
	event, err := github.ParseWebHook(messageType, payload)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid payload")
	}

	switch event := event.(type) {
	case *github.PushEvent:
		return r.parsePushEvent(event)
	case *github.PullRequestEvent:
		return r.parsePullRequestEvent(event)
	case *github.PingEvent:
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK,
			Message: "ping received",
		}, nil
	}

	return &provisioning.WebhookResponse{
		Code:    http.StatusNotImplemented,
		Message: fmt.Sprintf("unsupported messageType: %s", messageType),
	}, nil
}

func (r *githubRepository) parsePushEvent(event *github.PushEvent) (*provisioning.WebhookResponse, error) {
	if event.GetRepo() == nil {
		return nil, fmt.Errorf("missing repository in push event")
	}
	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository) {
		return nil, fmt.Errorf("repository mismatch")
	}
	// Skip silently if the event is not for the main/master branch
	// as we cannot configure the webhook to only publish events for the main branch
	if event.GetRef() != fmt.Sprintf("refs/heads/%s", r.config.Spec.GitHub.Branch) {
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	var count int
	for _, commit := range event.Commits {
		for _, file := range commit.Added {
			if r.ignore(file) {
				continue
			}
			count++
		}

		for _, file := range commit.Modified {
			if r.ignore(file) {
				continue
			}
			count++
		}

		for _, file := range commit.Removed {
			if r.ignore(file) {
				continue
			}
			count++
		}
	}

	if count == 0 {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK, // Nothing needed
			Message: "no files require updates",
		}, nil
	}

	return &provisioning.WebhookResponse{
		Code: http.StatusAccepted,
		Job: &provisioning.JobSpec{
			Action: provisioning.JobActionSync,
		},
	}, nil
}

func (r *githubRepository) parsePullRequestEvent(event *github.PullRequestEvent) (*provisioning.WebhookResponse, error) {
	if event.GetRepo() == nil {
		return nil, fmt.Errorf("missing repository in pull request event")
	}
	cfg := r.config.Spec.GitHub
	if cfg == nil {
		return nil, fmt.Errorf("missing github config")
	}

	if !r.shouldLintPullRequest() && !cfg.GenerateDashboardPreviews {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK, // Nothing needed
			Message: "no action required on pull request event",
		}, nil
	}

	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", cfg.Owner, cfg.Repository) {
		return nil, fmt.Errorf("repository mismatch")
	}
	pr := event.GetPullRequest()
	if pr == nil {
		return nil, fmt.Errorf("expected PR in event")
	}

	if pr.GetBase().GetRef() != fmt.Sprintf("refs/heads/%s", r.config.Spec.GitHub.Branch) {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK,
			Message: "ignoring pull request event as it is not for the configured branch",
		}, nil
	}

	action := event.GetAction()
	if action != "opened" && action != "reopened" && action != "synchronize" {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK, // Nothing needed
			Message: fmt.Sprintf("ignore pull request event: %s", action),
		}, nil
	}

	// Queue an async job that will parse files
	return &provisioning.WebhookResponse{
		Code:    http.StatusAccepted, // Nothing needed
		Message: fmt.Sprintf("pull request: %s", action),
		Job: &provisioning.JobSpec{
			Action: provisioning.JobActionPullRequest,
			URL:    pr.GetHTMLURL(),
			PR:     pr.GetNumber(),
			Ref:    pr.GetHead().GetRef(),
			Hash:   pr.GetHead().GetSHA(),
		},
	}, nil
}

func (r *githubRepository) LatestRef(ctx context.Context) (string, error) {
	branch, err := r.gh.GetBranch(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, r.Config().Spec.GitHub.Branch)
	if err != nil {
		return "", fmt.Errorf("get branch: %w", err)
	}

	return branch.Sha, nil
}

func (r *githubRepository) CompareFiles(ctx context.Context, logger *slog.Logger, base, ref string) ([]FileChange, error) {
	if ref == "" {
		var err error
		ref, err = r.LatestRef(ctx)
		if err != nil {
			return nil, fmt.Errorf("get latest ref: %w", err)
		}
	}

	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository
	files, err := r.gh.CompareCommits(ctx, owner, repo, base, ref)
	if err != nil {
		return nil, fmt.Errorf("compare commits: %w", err)
	}

	changes := make([]FileChange, 0)
	// TODO: handle all statuses
	for _, f := range files {
		// TODO: where should I ignore files?
		if r.ignore(f.GetFilename()) {
			continue
		}
		// reference: https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#get-a-commit
		switch f.GetStatus() {
		case "added":
			changes = append(changes, FileChange{
				Path:   f.GetFilename(),
				Ref:    ref,
				Action: FileActionCreated,
			})
		case "modified", "changed":
			changes = append(changes, FileChange{
				Path:   f.GetFilename(),
				Ref:    ref,
				Action: FileActionUpdated,
			})
		case "renamed":
			// delete the old file
			changes = append(changes, FileChange{
				Path:   f.GetPreviousFilename(),
				Ref:    base,
				Action: FileActionDeleted,
			})
			// replicate the new file
			changes = append(changes, FileChange{
				Path:   f.GetFilename(),
				Ref:    ref,
				Action: FileActionCreated,
			})
		case "removed":
			changes = append(changes, FileChange{
				Ref:    base,
				Path:   f.GetFilename(),
				Action: FileActionDeleted,
			})
		default:
			logger.ErrorContext(ctx, "ignore unhandled file", "file", f.GetFilename(), "status", f.GetStatus())
		}
	}

	return changes, nil
}

func (r *githubRepository) shouldLintPullRequest() bool {
	return r.config.Spec.GitHub.PullRequestLinter && r.config.Spec.Linting
}

// CommentPullRequest adds a comment to a pull request.
func (r *githubRepository) CommentPullRequest(ctx context.Context, logger *slog.Logger, prNumber int, comment string) error {
	return r.gh.CreatePullRequestComment(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, prNumber, comment)
}

// CommentPullRequestFile lints a file and comments the issues found.
func (r *githubRepository) CommentPullRequestFile(ctx context.Context, logger *slog.Logger, prNumber int, path, ref, comment string) error {
	fileComment := pgh.FileComment{
		Content:  comment,
		Path:     path,
		Position: 1, // create a top-level comment
		Ref:      ref,
	}

	// FIXME: comment with Grafana Logo
	// FIXME: comment author should be written by Grafana and not the user
	return r.gh.CreatePullRequestFileComment(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, prNumber, fileComment)
}

func (r *githubRepository) createWebhook(ctx context.Context, logger *slog.Logger) error {
	cfg := pgh.WebhookConfig{
		URL:         r.config.Spec.GitHub.WebhookURL,
		Secret:      r.config.Spec.GitHub.WebhookSecret,
		ContentType: "json",
		Events:      []string{"push", "pull_request"},
		Active:      true,
	}

	if err := r.gh.CreateWebhook(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, cfg); err != nil {
		return err
	}

	logger.InfoContext(ctx, "webhook created", "url", cfg.URL)
	return nil
}

func (r *githubRepository) updateWebhook(ctx context.Context, logger *slog.Logger, oldRepo *githubRepository) (UndoFunc, error) {
	owner := r.config.Spec.GitHub.Owner
	repoName := r.config.Spec.GitHub.Repository

	hooks, err := r.gh.ListWebhooks(ctx, owner, repoName)
	if err != nil {
		return nil, fmt.Errorf("list existing webhooks: %w", err)
	}

	newCfg := r.config.Spec.GitHub
	oldCfg := oldRepo.Config().Spec.GitHub

	switch {
	case newCfg.WebhookURL != oldCfg.WebhookURL:
		// In this case we cannot find out out which webhook to update, so we delete the old one and create a new one
		if err := r.createWebhook(ctx, logger); err != nil {
			return nil, fmt.Errorf("create new webhook: %w", err)
		}

		undoFunc := UndoFunc(func(ctx context.Context) error {
			if err := r.deleteWebhook(ctx, logger); err != nil {
				return fmt.Errorf("revert create new webhook: %w", err)
			}

			logger.InfoContext(ctx, "create new webhook reverted", "url", newCfg.WebhookURL)

			return nil
		})

		if err := oldRepo.deleteWebhook(ctx, logger); err != nil {
			return undoFunc, fmt.Errorf("delete old webhook: %w", err)
		}

		undoFunc = undoFunc.Chain(ctx, func(ctx context.Context) error {
			if err := oldRepo.createWebhook(ctx, logger); err != nil {
				return fmt.Errorf("revert delete old webhook: %w", err)
			}

			logger.InfoContext(ctx, "delete old webhook reverted", "url", oldCfg.WebhookURL)

			return nil
		})

		return undoFunc, nil
	case newCfg.WebhookSecret != oldCfg.WebhookSecret:
		for _, hook := range hooks {
			if hook.URL == oldCfg.WebhookURL {
				hook.Secret = newCfg.WebhookSecret
				err := r.gh.EditWebhook(ctx, owner, repoName, hook)
				if err != nil {
					return nil, fmt.Errorf("update webhook secret: %w", err)
				}

				logger.InfoContext(ctx, "webhook secret updated", "url", newCfg.WebhookURL)

				return func(ctx context.Context) error {
					hook.Secret = oldCfg.WebhookSecret
					if err := r.gh.EditWebhook(ctx, owner, repoName, hook); err != nil {
						return fmt.Errorf("revert webhook secret: %w", err)
					}

					logger.InfoContext(ctx, "webhook secret reverted", "url", oldCfg.WebhookURL)
					return nil
				}, nil
			}
		}

		return nil, errors.New("webhook not found")
	default:
		return nil, nil
	}
}

func (r *githubRepository) deleteWebhook(ctx context.Context, logger *slog.Logger) error {
	owner := r.config.Spec.GitHub.Owner
	name := r.config.Spec.GitHub.Repository

	hooks, err := r.gh.ListWebhooks(ctx, owner, name)
	if err != nil {
		return fmt.Errorf("list existing webhooks: %w", err)
	}

	for _, hook := range hooks {
		if hook.URL == r.config.Spec.GitHub.WebhookURL {
			if err := r.gh.DeleteWebhook(ctx, owner, name, hook.ID); err != nil {
				return fmt.Errorf("delete webhook: %w", err)
			}
		}
	}

	logger.InfoContext(ctx, "webhook deleted", "url", r.config.Spec.GitHub.WebhookURL)
	return nil
}

func (r *githubRepository) AfterCreate(ctx context.Context, logger *slog.Logger) error {
	return r.createWebhook(ctx, logger)
}

func (r *githubRepository) BeginUpdate(ctx context.Context, logger *slog.Logger, old Repository) (UndoFunc, error) {
	oldGitRepo, ok := old.(*githubRepository)
	if !ok {
		return nil, fmt.Errorf("old repository is not a github repository")
	}

	return r.updateWebhook(ctx, logger, oldGitRepo)
}

func (r *githubRepository) AfterDelete(ctx context.Context, logger *slog.Logger) error {
	return r.deleteWebhook(ctx, logger)
}
