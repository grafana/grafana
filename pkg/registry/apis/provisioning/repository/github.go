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
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
)

type githubRepository struct {
	logger *slog.Logger
	config *provisioning.Repository
	gh     pgh.Client
}

var _ Repository = (*githubRepository)(nil)

func NewGitHub(ctx context.Context, config *provisioning.Repository, factory pgh.ClientFactory) *githubRepository {
	return &githubRepository{
		config: config,
		logger: slog.Default().With("logger", "github-repository"),
		gh:     factory.New(ctx, config.Spec.GitHub.Token),
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

	switch gh.SubmitChangeMode {
	case provisioning.PullRequestOnlyMode, provisioning.DirectPushOnlyMode, provisioning.PullRequestByDefaultMode, provisioning.DirectPushByDefaultMode:
	default:
		list = append(list, field.Invalid(field.NewPath("spec", "github", "submitChangeMode"), gh.SubmitChangeMode, "invalid submit change mode"))
	}

	return list
}

// Test implements provisioning.Repository.
func (r *githubRepository) Test(ctx context.Context, logger *slog.Logger) error {
	return &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Message: "test is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// ReadResource implements provisioning.Repository.
func (r *githubRepository) Read(ctx context.Context, logger *slog.Logger, filePath, ref string) (*FileInfo, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository

	content, _, err := r.gh.GetContents(ctx, owner, repo, filePath, ref)
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

func (r *githubRepository) Create(ctx context.Context, logger *slog.Logger, path, ref string, data []byte, comment string) error {
	ref, err := r.prepareToWrite(ctx, ref)
	if err != nil {
		return fmt.Errorf("prepare to write for create: %w", err)
	}

	owner := r.config.Spec.GitHub.Owner
	repo := r.config.Spec.GitHub.Repository

	err = r.gh.CreateFile(ctx, owner, repo, path, ref, comment, data)
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
	ref, err := r.prepareToWrite(ctx, ref)
	if err != nil {
		return fmt.Errorf("prepare to write for update: %w", err)
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
	ref, err := r.prepareToWrite(ctx, ref)
	if err != nil {
		return fmt.Errorf("prepare to write for delete: %w", err)
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

// prepareToWrite checks if the write operation is allowed for the provided ref and creates the branch if needed.
// It returns the branch name to use for the write operation.
func (r *githubRepository) prepareToWrite(ctx context.Context, ref string) (string, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

	if !r.isWriteToRefAllowed(ref) {
		return "", &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Code:    http.StatusForbidden,
				Message: "write operation is not allowed for the provided ref",
			},
		}
	}

	if err := r.ensureBranchExists(ctx, ref); err != nil {
		return "", fmt.Errorf("ensure branch exists: %w", err)
	}

	return ref, nil
}

// isWriteToRefAllowed checks if the write operation is allowed for the provided ref.
// mostly based on the exclusive modes.
func (r *githubRepository) isWriteToRefAllowed(ref string) bool {
	mode := r.config.Spec.GitHub.SubmitChangeMode
	if ref == r.config.Spec.GitHub.Branch {
		return mode != provisioning.PullRequestOnlyMode
	} else {
		return mode != provisioning.DirectPushOnlyMode
	}
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

// Webhook implements provisioning.Repository.
func (r *githubRepository) Webhook(ctx context.Context, logger *slog.Logger, responder rest.Responder) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		// We don't want GitHub's request to cause a cancellation for us, but we also want the request context's data (primarily for logging).
		// This means we will just ignore when GH closes their connection to us. If we respond in time, fantastic. Otherwise, we'll still do the work.
		// The cancel we do here is mainly just to make sure that no goroutines can accidentally stay living forever.
		//
		// TODO: Should we have our own timeout here? Even if pretty crazy high (e.g. 30 min)?
		ctx, cancel := context.WithCancel(context.WithoutCancel(req.Context()))
		defer cancel()

		payload, err := github.ValidatePayload(req, []byte(r.config.Spec.GitHub.WebhookSecret))
		if err != nil {
			responder.Error(apierrors.NewUnauthorized("invalid signature"))
			return
		}

		eventType := github.WebHookType(req)
		event, err := github.ParseWebHook(github.WebHookType(req), payload)
		if err != nil {
			responder.Error(apierrors.NewBadRequest("invalid payload"))
			return
		}

		switch event := event.(type) {
		case *github.PushEvent:
			if err := r.onPushEvent(ctx, logger, event); err != nil {
				responder.Error(err)
				return
			}

			responder.Object(200, &metav1.Status{
				Message: "event processed",
				Code:    http.StatusOK,
			})
		case *github.PingEvent:
			responder.Object(200, &metav1.Status{
				Message: "ping received",
				Code:    http.StatusOK,
			})
		default:
			responder.Error(apierrors.NewBadRequest("unsupported event type: " + eventType))
		}
	}
}

func (r *githubRepository) onPushEvent(ctx context.Context, logger *slog.Logger, event *github.PushEvent) error {
	logger = logger.With("ref", event.GetRef())

	if event.GetRepo() == nil {
		return fmt.Errorf("missing repository in push event")
	}

	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository) {
		return fmt.Errorf("repository mismatch")
	}

	// Skip silently if the event is not for the main/master branch
	// as we cannot configure the webhook to only publish events for the main branch
	if event.GetRef() != fmt.Sprintf("refs/heads/%s", r.config.Spec.GitHub.Branch) {
		logger.DebugContext(ctx, "ignoring push event as it is not for the configured branch")
		return nil
	}

	beforeRef := event.GetBefore()

	for _, commit := range event.Commits {
		logger := logger.With("commit", commit.GetID(), "message", commit.GetMessage())
		logger.InfoContext(ctx, "processing commit")

		for _, file := range commit.Added {
			logger := logger.With("change", "added", "file", file)
			info, err := r.Read(ctx, logger, file, commit.GetID())
			if err != nil {
				return fmt.Errorf("read added resource: %w", err)
			}

			logger.InfoContext(ctx, "added file", "resource", string(info.Data))
		}

		for _, file := range commit.Modified {
			logger := logger.With("change", "modified", "file", file)
			info, err := r.Read(ctx, logger, file, commit.GetID())
			if err != nil {
				return fmt.Errorf("read modified resource: %w", err)
			}

			logger.InfoContext(ctx, "modified file", "resource", string(info.Data))
		}

		for _, file := range commit.Removed {
			logger := logger.With("change", "removed", "file", file)
			info, err := r.Read(ctx, logger, file, beforeRef)
			if err != nil {
				return fmt.Errorf("read removed resource: %w", err)
			}

			logger.InfoContext(ctx, "removed file", "resource", string(info.Data))
		}

		beforeRef = commit.GetID()
	}

	return nil
}

func (r *githubRepository) createWebhook(ctx context.Context, logger *slog.Logger) error {
	cfg := pgh.WebhookConfig{
		URL:         r.config.Spec.GitHub.WebhookURL,
		Secret:      r.config.Spec.GitHub.WebhookSecret,
		ContentType: "json",
		Events:      []string{"push"},
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
