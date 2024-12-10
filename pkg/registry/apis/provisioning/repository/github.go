package repository

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"text/template"

	"github.com/google/go-github/v66/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/lint"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
)

type githubRepository struct {
	logger        *slog.Logger
	config        *provisioning.Repository
	gh            pgh.Client
	baseURL       *url.URL
	linterFactory lint.LinterFactory
	renderer      PreviewRenderer
	ignore        provisioning.IgnoreFile
}

var _ Repository = (*githubRepository)(nil)

func NewGitHub(
	ctx context.Context,
	config *provisioning.Repository,
	factory pgh.ClientFactory,
	baseURL *url.URL,
	linterFactory lint.LinterFactory,
	renderer PreviewRenderer,
) *githubRepository {
	return &githubRepository{
		config:        config,
		logger:        slog.Default().With("logger", "github-repository"),
		gh:            factory.New(ctx, config.Spec.GitHub.Token),
		baseURL:       baseURL,
		linterFactory: linterFactory,
		renderer:      renderer,
		ignore:        provisioning.IncludeYamlOrJSON,
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
		r.logger.Debug("ignoring push event as it is not for the configured branch")
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	job := &provisioning.JobSpec{
		Action: provisioning.JobActionMergeBranch,
	}

	beforeRef := event.GetBefore()
	for _, commit := range event.Commits {
		commitInfo := provisioning.CommitInfo{
			SHA1: commit.GetID(),
		}

		count := 0
		for _, file := range commit.Added {
			if r.ignore(file) {
				continue
			}

			commitInfo.Added = append(commitInfo.Added, provisioning.FileRef{
				Ref:  commit.GetID(),
				Path: file,
			})
			count++
		}

		for _, file := range commit.Modified {
			if r.ignore(file) {
				continue
			}
			commitInfo.Modified = append(commitInfo.Modified, provisioning.FileRef{
				Ref:  commit.GetID(),
				Path: file,
			})
			count++
		}

		for _, file := range commit.Removed {
			if r.ignore(file) {
				continue
			}

			commitInfo.Removed = append(commitInfo.Removed, provisioning.FileRef{
				Ref:  beforeRef,
				Path: file,
			})
			count++
		}

		if count > 0 {
			job.Commits = append(job.Commits, commitInfo)
		}
		beforeRef = commit.GetID()
	}

	if len(job.Commits) == 0 {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK, // Nothing needed
			Message: "no files require updates",
		}, nil
	}

	return &provisioning.WebhookResponse{
		Code: http.StatusAccepted,
		Job:  job,
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

	if pr.GetBase().GetRef() != cfg.Branch {
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

// Process is a backend job
func (r *githubRepository) Process(ctx context.Context, logger *slog.Logger, wrap provisioning.Job, factory FileReplicatorFactory) error {
	job := wrap.Spec

	// TODO... verify added vs removed vs modified... should not process 2x!
	replicator, err := factory.New()
	if err != nil {
		return fmt.Errorf("create replicator: %w", err)
	}

	if job.PR > 0 {
		return r.processPR(ctx, logger, job, replicator)
	}

	// NOTE: Everything below here is not git specific
	for _, commit := range job.Commits {
		// NOT PR, this is processing the actual files
		for _, v := range commit.Added {
			fileInfo, err := r.Read(ctx, logger, v.Path, v.Ref)
			if err != nil {
				logger.ErrorContext(ctx, "failed to read added resource", "file", v, "error", err)
				continue
			}

			err = replicator.Replicate(ctx, fileInfo)
			if err != nil {
				logger.ErrorContext(ctx, "failed to replicate added resource", "file", v, "error", err)
				continue
			}
		}
		for _, v := range commit.Modified {
			fileInfo, err := r.Read(ctx, logger, v.Path, v.Ref)
			if err != nil {
				logger.ErrorContext(ctx, "failed to read modified resource", "file", v, "error", err)
				continue
			}

			err = replicator.Replicate(ctx, fileInfo)
			if err != nil {
				logger.ErrorContext(ctx, "failed to replicate modified resource", "file", v, "error", err)
				continue
			}
		}

		for _, v := range commit.Removed {
			fileInfo, err := r.Read(ctx, logger, v.Path, v.Ref)
			if err != nil {
				logger.ErrorContext(ctx, "failed to read removed resource", "file", v, "error", err)
				continue
			}

			if err := replicator.Delete(ctx, fileInfo); err != nil {
				logger.ErrorContext(ctx, "failed to delete resource", "file", v, "error", err)
				continue
			}
		}
	}

	return nil
}

// Process a pull request
func (r *githubRepository) processPR(ctx context.Context, logger *slog.Logger, job provisioning.JobSpec, replicator FileReplicator) error {
	// Get the files changed in the pull request
	files, err := r.gh.ListPullRequestFiles(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, job.PR)
	if err != nil {
		return fmt.Errorf("list pull request files: %w", err)
	}

	changedResources := make([]changedResource, 0)

	baseBranch := job.Ref
	mainBranch := r.config.Spec.GitHub.Branch
	prURL := job.URL

	for _, file := range files {
		if r.ignore(file.GetFilename()) {
			continue
		}

		resource := changedResource{
			Filename: path.Base(file.GetFilename()),
			Path:     file.GetFilename(),
			Action:   file.GetStatus(),
			Type:     "dashboard", // TODO: get this from the resource
			Ref:      job.Ref,
		}

		path := file.GetFilename()
		logger := logger.With("file", path, "status", file.GetStatus(), "sha", file.GetSHA())

		// reference: https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#get-a-commit
		switch file.GetStatus() {
		case "added":
			resource.PreviewURL = r.previewURL(resource.Ref, path, prURL)
		case "modified":
			resource.OriginalURL = r.previewURL(baseBranch, path, prURL)
			resource.CurrentURL = r.previewURL(mainBranch, path, prURL)
			resource.PreviewURL = r.previewURL(resource.Ref, path, prURL)
		case "removed":
			resource.OriginalURL = r.previewURL(baseBranch, path, prURL)
			resource.CurrentURL = r.previewURL(mainBranch, path, prURL)
			resource.Ref = baseBranch
		case "renamed":
			resource.OriginalURL = r.previewURL(baseBranch, file.GetPreviousFilename(), prURL)
			resource.CurrentURL = r.previewURL(mainBranch, file.GetPreviousFilename(), prURL)
			resource.PreviewURL = r.previewURL(resource.Ref, path, prURL)
		case "changed":
			resource.OriginalURL = r.previewURL(baseBranch, path, prURL)
			resource.CurrentURL = r.previewURL(mainBranch, path, prURL)
			resource.PreviewURL = r.previewURL(resource.Ref, path, prURL)
		case "unchanged":
			logger.InfoContext(ctx, "ignore unchanged file")
			continue
		default:
			logger.ErrorContext(ctx, "unhandled pull request file")
			continue
		}

		f, err := r.Read(ctx, logger, path, resource.Ref)
		if err != nil {
			logger.ErrorContext(ctx, "failed to read file", "error", err)
			continue
		}

		// TODO: how does this validation works vs linting?
		ok, err := replicator.Validate(ctx, f)
		if err != nil {
			logger.ErrorContext(ctx, "failed to validate file", "error", err)
			continue
		}
		if !ok {
			logger.InfoContext(ctx, "ignore file as it is not a valid resource")
			continue
		}

		resource.Data = f.Data
		logger.InfoContext(ctx, "resource changed")
		changedResources = append(changedResources, resource)
	}

	if err := r.previewPullRequest(ctx, logger, job.PR, changedResources); err != nil {
		logger.ErrorContext(ctx, "failed to comment previews", "error", err)
	}

	headSha := job.Hash
	if err := r.lintPullRequest(ctx, logger, job.PR, headSha, changedResources); err != nil {
		logger.ErrorContext(ctx, "failed to lint pull request resources", "error", err)
	}

	return nil
}

// changedResource represents a resource that has changed in a pull request.
type changedResource struct {
	Filename             string
	Path                 string
	Ref                  string
	Action               string
	Type                 string
	OriginalURL          string
	CurrentURL           string
	PreviewURL           string
	PreviewScreenshotURL string
	Data                 []byte
}

func (r *githubRepository) shouldLintPullRequest() bool {
	return r.config.Spec.GitHub.PullRequestLinter && r.config.Spec.Linting
}

var lintDashboardIssuesTemplate = `Hey there! 👋
Grafana found some linting issues in this dashboard you may want to check:
{{ range .}}
{{ if eq .Severity "error" }}❌{{ else if eq .Severity "warning" }}⚠️ {{ end }} [dashboard-linter/{{ .Rule }}](https://github.com/grafana/dashboard-linter/blob/main/docs/rules/{{ .Rule }}.md): {{ .Message }}.
{{- end }}
`

// lintPullRequest lints the files changed in the pull request and comments the issues found.
// The linter is disabled if the configuration does not have PullRequestLinter enabled.
// The only supported type of file to lint is a dashboard.
func (r *githubRepository) lintPullRequest(ctx context.Context, logger *slog.Logger, prNumber int, ref string, resources []changedResource) error {
	if !r.shouldLintPullRequest() {
		return nil
	}

	logger.InfoContext(ctx, "lint pull request")

	// Load linter config
	cfg, err := r.Read(ctx, logger, r.linterFactory.ConfigPath(), ref)
	switch {
	case err == nil:
		logger.InfoContext(ctx, "linter config found", "config", string(cfg.Data))
	case errors.Is(err, pgh.ErrResourceNotFound):
		logger.InfoContext(ctx, "no linter config found")
	default:
		return fmt.Errorf("read linter config: %w", err)
	}

	linter, err := r.linterFactory.NewFromConfig(cfg.Data)
	if err != nil {
		return fmt.Errorf("create linter: %w", err)
	}

	// Clear all previous comments because we don't know if the files have changed
	if err := r.gh.ClearAllPullRequestFileComments(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, prNumber); err != nil {
		return fmt.Errorf("clear pull request comments: %w", err)
	}

	for _, resource := range resources {
		if resource.Action == "removed" || resource.Type != "dashboard" {
			continue
		}

		logger := logger.With("file", resource.Path)
		if err := r.lintPullRequestFile(ctx, logger, prNumber, ref, resource, linter); err != nil {
			logger.ErrorContext(ctx, "failed to lint file", "error", err)
		}
	}

	return nil
}

// lintPullRequestFile lints a file and comments the issues found.
func (r *githubRepository) lintPullRequestFile(ctx context.Context, logger *slog.Logger, prNumber int, ref string, resource changedResource, linter lint.Linter) error {
	issues, err := linter.Lint(ctx, resource.Data)
	if err != nil {
		return fmt.Errorf("lint file: %w", err)
	}

	if len(issues) == 0 {
		return nil
	}

	// FIXME: we should not be compiling this all the time
	tmpl, err := template.New("comment").Parse(lintDashboardIssuesTemplate)
	if err != nil {
		return fmt.Errorf("parse lint comment template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, issues); err != nil {
		return fmt.Errorf("execute lint comment template: %w", err)
	}

	comment := pgh.FileComment{
		Content:  buf.String(),
		Path:     resource.Path,
		Position: 1, // create a top-level comment
		Ref:      ref,
	}

	// FIXME: comment with Grafana Logo
	// FIXME: comment author should be written by Grafana and not the user
	if err := r.gh.CreatePullRequestFileComment(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, prNumber, comment); err != nil {
		return fmt.Errorf("create pull request comment: %w", err)
	}
	logger.InfoContext(ctx, "lint comment created", "issues", len(issues))

	return nil
}

const previewsCommentTemplate = `Hey there! 🎉
Grafana spotted some changes for your resources in this pull request:

## Summary
| File Name | Type | Path | Action | Links |
|-----------|------|------|--------|-------|
{{- range .}}
| {{.Filename}} | {{.Type}} | {{.Path}} | {{.Action}} | {{if .OriginalURL}}[Original]({{.OriginalURL}}){{end}}{{if .CurrentURL}}, [Current]({{.CurrentURL}}){{end}}{{if .PreviewURL}}, [Preview]({{.PreviewURL}}){{end}}|
{{- end}}

Click the preview links above to view how your changes will look and compare them with the original and current versions.

{{- range .}}
{{- if .PreviewScreenshotURL}}
### Preview of {{.Filename}}
![Preview]({{.PreviewScreenshotURL}})
{{- end}}
{{- end}}`

func (r *githubRepository) previewPullRequest(ctx context.Context, logger *slog.Logger, prNumber int, resources []changedResource) error {
	if !r.Config().Spec.GitHub.GenerateDashboardPreviews || len(resources) == 0 {
		return nil
	}

	// generate preview image for each dashboard if not removed
	for i, resource := range resources {
		if resource.Action == "removed" {
			continue
		}

		screenshotURL, err := r.renderer.RenderDashboardPreview(ctx, r, resource.Path, resource.Ref)
		if err != nil {
			return fmt.Errorf("render dashboard preview: %w", err)
		}

		resources[i].PreviewScreenshotURL = screenshotURL
		logger.InfoContext(ctx, "dashboard preview screenshot created", "file", resource.Path, "url", screenshotURL)
	}

	// FIXME: we should not be compiling this all the time
	tmpl, err := template.New("comment").Parse(previewsCommentTemplate)
	if err != nil {
		return fmt.Errorf("parse comment template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, resources); err != nil {
		return fmt.Errorf("execute comment template: %w", err)
	}

	comment := buf.String()

	// FIXME: comment with Grafana Logo
	// FIXME: comment author should be written by Grafana and not the user
	if err := r.gh.CreatePullRequestComment(ctx, r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository, prNumber, comment); err != nil {
		return fmt.Errorf("create pull request comment: %w", err)
	}

	logger.InfoContext(ctx, "preview comment created", "resources", len(resources))

	return nil
}

// previewURL returns the URL to preview the file in Grafana
func (r *githubRepository) previewURL(ref, filePath, pullRequestURL string) string {
	// Copy the baseURL to modify path and query
	baseURL := *r.baseURL
	baseURL.Path = path.Join(baseURL.Path, "/admin/provisioning", r.Config().GetName(), "dashboard/preview", filePath)

	query := baseURL.Query()
	if ref != "" {
		query.Set("ref", ref)
	}
	if pullRequestURL != "" {
		query.Set("pull_request_url", url.QueryEscape(pullRequestURL))
	}
	baseURL.RawQuery = query.Encode()

	return baseURL.String()
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
