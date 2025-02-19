package repository

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"slices"
	"strings"

	"github.com/google/go-github/v66/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/google/uuid"
	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

var subscribedEvents = []string{"push", "pull_request"}

// Make sure all public functions of this struct call the (*githubRepository).logger function, to ensure the GH repo details are included.
type githubRepository struct {
	config     *provisioning.Repository
	gh         pgh.Client // assumes github.com base URL
	secrets    secrets.Service
	webhookURL string

	owner string
	repo  string
}

var (
	_ Repository          = (*githubRepository)(nil)
	_ RepositoryHooks     = (*githubRepository)(nil)
	_ VersionedRepository = (*githubRepository)(nil)
)

func NewGitHub(
	ctx context.Context,
	config *provisioning.Repository,
	factory *pgh.Factory,
	secrets secrets.Service,
	webhookURL string,
) (*githubRepository, error) {
	owner, repo, _ := parseOwnerRepo(config.Spec.GitHub.URL)
	decrypted, err := secrets.Decrypt(ctx, config.Spec.GitHub.EncryptedToken)
	if err != nil {
		return nil, err
	}
	return &githubRepository{
		config:     config,
		gh:         factory.New(ctx, string(decrypted)), // TODO -- base from URL
		secrets:    secrets,
		webhookURL: webhookURL,
		owner:      owner,
		repo:       repo,
	}, nil
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
	if gh.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "url"), "a github url is required"))
	} else {
		_, _, err := parseOwnerRepo(gh.URL)
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, err.Error()))
		} else if !strings.HasPrefix(gh.URL, "https://github.com/") {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, "URL must start with https://github.com/"))
		}
	}
	if gh.Branch == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "branch"), "a github branch is required"))
	}
	if !isValidGitBranchName(gh.Branch) {
		list = append(list, field.Invalid(field.NewPath("spec", "github", "branch"), gh.Branch, "invalid branch name"))
	}
	// TODO: Use two fields for token
	if gh.Token == "" && len(gh.EncryptedToken) == 0 {
		list = append(list, field.Required(field.NewPath("spec", "github", "token"), "a github access token is required"))
	}

	for _, w := range gh.Workflows {
		switch w {
		case provisioning.PushWorkflow, provisioning.BranchWorkflow:
		default:
			list = append(list, field.Invalid(field.NewPath("spec", "github", "workflow"), w, "invalid workflow"))
		}
	}

	return list
}

func parseOwnerRepo(giturl string) (owner string, repo string, err error) {
	parsed, e := url.Parse(giturl)
	if e != nil {
		err = e
		return
	}
	parts := strings.Split(parsed.Path, "/")
	if len(parts) < 3 {
		err = fmt.Errorf("unable to parse repo+owner from url")
		return
	}
	return parts[1], parts[2], nil
}

// Test implements provisioning.Repository.
func (r *githubRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	if err := r.gh.IsAuthenticated(ctx); err != nil {
		// TODO: should we return a more specific error or error code?
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors:  []string{err.Error()},
		}, nil
	}

	owner, repo, err := parseOwnerRepo(r.config.Spec.GitHub.URL)
	if err != nil {
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors:  []string{err.Error()},
		}, nil
	}

	// FIXME: check token permissions
	ok, err := r.gh.RepoExists(ctx, owner, repo)
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

	ok, err = r.gh.BranchExists(ctx, r.owner, r.repo, r.config.Spec.GitHub.Branch)
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
func (r *githubRepository) Read(ctx context.Context, filePath, ref string) (*FileInfo, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

	content, dirContent, err := r.gh.GetContents(ctx, r.owner, r.repo, filePath, ref)
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
		return &FileInfo{
			Path: filePath,
			Ref:  ref,
		}, nil
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

func (r *githubRepository) ReadTree(ctx context.Context, ref string) ([]FileTreeEntry, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

	ctx, logger := r.logger(ctx, ref)

	tree, truncated, err := r.gh.GetTree(ctx, r.owner, r.repo, ref, true)
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
		logger.Warn("tree from github was truncated")
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

func (r *githubRepository) Create(ctx context.Context, path, ref string, data []byte, comment string) error {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	ctx, _ = r.logger(ctx, ref)
	if err := r.isWorkflowAllowed(ref); err != nil {
		return err
	}

	if err := r.ensureBranchExists(ctx, ref); err != nil {
		return fmt.Errorf("create branch on create: %w", err)
	}

	// Create .keep file if it is a directory
	if strings.HasSuffix(path, "/") {
		if data != nil {
			return apierrors.NewBadRequest("data cannot be provided for a directory")
		}

		path = strings.TrimSuffix(path, "/") + "/.keep"
		data = []byte{}
	}

	err := r.gh.CreateFile(ctx, r.owner, r.repo, path, ref, comment, data)
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

func (r *githubRepository) Update(ctx context.Context, path, ref string, data []byte, comment string) error {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	ctx, _ = r.logger(ctx, ref)
	if err := r.isWorkflowAllowed(ref); err != nil {
		return err
	}

	if err := r.ensureBranchExists(ctx, ref); err != nil {
		return fmt.Errorf("create branch on update: %w", err)
	}

	file, _, err := r.gh.GetContents(ctx, r.owner, r.repo, path, ref)
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
	if file.IsDirectory() {
		return apierrors.NewBadRequest("cannot update a directory")
	}

	if err := r.gh.UpdateFile(ctx, r.owner, r.repo, path, ref, comment, file.GetSHA(), data); err != nil {
		return fmt.Errorf("update file: %w", err)
	}
	return nil
}

func (r *githubRepository) Write(ctx context.Context, path string, ref string, data []byte, message string) error {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	ctx, _ = r.logger(ctx, ref)
	if err := r.isWorkflowAllowed(ref); err != nil {
		return err
	}

	return writeWithReadThenCreateOrUpdate(ctx, r, path, ref, data, message)
}

func (r *githubRepository) Delete(ctx context.Context, path, ref, comment string) error {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	ctx, _ = r.logger(ctx, ref)
	if err := r.isWorkflowAllowed(ref); err != nil {
		return err
	}

	if err := r.ensureBranchExists(ctx, ref); err != nil {
		return fmt.Errorf("create branch on delete: %w", err)
	}

	return r.deleteRecursively(ctx, path, ref, comment)
}

func (r *githubRepository) deleteRecursively(ctx context.Context, path, ref, comment string) error {
	file, contents, err := r.gh.GetContents(ctx, r.owner, r.repo, path, ref)
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

	if file != nil && !file.IsDirectory() {
		return r.gh.DeleteFile(ctx, r.owner, r.repo, path, ref, comment, file.GetSHA())
	}

	for _, c := range contents {
		if c.IsDirectory() {
			if err := r.deleteRecursively(ctx, c.GetPath(), ref, comment); err != nil {
				return fmt.Errorf("delete file recursive: %w", err)
			}
			continue
		}

		if err := r.gh.DeleteFile(ctx, r.owner, r.repo, c.GetPath(), ref, comment, c.GetSHA()); err != nil {
			return fmt.Errorf("delete file: %w", err)
		}
	}

	return nil
}

func (r *githubRepository) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	ctx, _ = r.logger(ctx, ref)

	commits, err := r.gh.Commits(ctx, r.owner, r.repo, path, ref)
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
			CreatedAt: commit.CreatedAt.UnixMilli(),
		})
	}

	return ret, nil
}

func (r *githubRepository) isWorkflowAllowed(ref string) error {
	cfg := r.config.Spec

	workflows := make(map[provisioning.Workflow]bool)
	for _, w := range cfg.GitHub.Workflows {
		workflows[w] = true
	}

	if ref == cfg.GitHub.Branch && !workflows[provisioning.PushWorkflow] {
		return apierrors.NewBadRequest("direct push not allowed")
	}

	if ref != cfg.GitHub.Branch && !workflows[provisioning.BranchWorkflow] {
		return apierrors.NewBadRequest("branch push not allowed")
	}

	return nil
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

	ok, err := r.gh.BranchExists(ctx, r.owner, r.repo, branchName)
	if err != nil {
		return fmt.Errorf("check branch exists: %w", err)
	}

	if ok {
		logging.FromContext(ctx).Info("branch already exists", "branch", branchName)

		return nil
	}

	srcBranch := r.config.Spec.GitHub.Branch
	if err := r.gh.CreateBranch(ctx, r.owner, r.repo, srcBranch, branchName); err != nil {
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
func (r *githubRepository) Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error) {
	if r.config.Status.Webhook == nil {
		return nil, fmt.Errorf("unexpected webhook request")
	}

	secret, err := r.secrets.Decrypt(ctx, r.config.Status.Webhook.EncryptedSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt secret: %w", err)
	}

	payload, err := github.ValidatePayload(req, secret)
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
	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.owner, r.repo) {
		return nil, fmt.Errorf("repository mismatch")
	}

	// No need to sync if not enabled
	if !r.config.Spec.Sync.Enabled {
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	// Skip silently if the event is not for the main/master branch
	// as we cannot configure the webhook to only publish events for the main branch
	if event.GetRef() != fmt.Sprintf("refs/heads/%s", r.config.Spec.GitHub.Branch) {
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	return &provisioning.WebhookResponse{
		Code: http.StatusAccepted,
		Job: &provisioning.JobSpec{
			Repository: r.Config().GetName(),
			Action:     provisioning.JobActionSync,
			Sync: &provisioning.SyncJobOptions{
				Incremental: true,
			},
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

	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.owner, r.repo) {
		return nil, fmt.Errorf("repository mismatch")
	}
	pr := event.GetPullRequest()
	if pr == nil {
		return nil, fmt.Errorf("expected PR in event")
	}

	if pr.GetBase().GetRef() != r.config.Spec.GitHub.Branch {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK,
			Message: fmt.Sprintf("ignoring pull request event as %s is not  the configured branch", pr.GetBase().GetRef()),
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
			Repository: r.Config().GetName(),
			Action:     provisioning.JobActionPullRequest,
			PullRequest: &provisioning.PullRequestJobOptions{
				URL:  pr.GetHTMLURL(),
				PR:   pr.GetNumber(),
				Ref:  pr.GetHead().GetRef(),
				Hash: pr.GetHead().GetSHA(),
			},
		},
	}, nil
}

func (r *githubRepository) LatestRef(ctx context.Context) (string, error) {
	ctx, _ = r.logger(ctx, "")
	branch, err := r.gh.GetBranch(ctx, r.owner, r.repo, r.Config().Spec.GitHub.Branch)
	if err != nil {
		return "", fmt.Errorf("get branch: %w", err)
	}

	return branch.Sha, nil
}

func (r *githubRepository) CompareFiles(ctx context.Context, base, ref string) ([]VersionedFileChange, error) {
	if ref == "" {
		var err error
		ref, err = r.LatestRef(ctx)
		if err != nil {
			return nil, fmt.Errorf("get latest ref: %w", err)
		}
	}
	ctx, logger := r.logger(ctx, ref)

	files, err := r.gh.CompareCommits(ctx, r.owner, r.repo, base, ref)
	if err != nil {
		return nil, fmt.Errorf("compare commits: %w", err)
	}

	changes := make([]VersionedFileChange, 0)
	for _, f := range files {
		// reference: https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#get-a-commit
		switch f.GetStatus() {
		case "added", "copied":
			changes = append(changes, VersionedFileChange{
				Path:   f.GetFilename(),
				Ref:    ref,
				Action: FileActionCreated,
			})
		case "modified", "changed":
			changes = append(changes, VersionedFileChange{
				Path:   f.GetFilename(),
				Ref:    ref,
				Action: FileActionUpdated,
			})
		case "renamed":
			changes = append(changes, VersionedFileChange{
				Path:         f.GetFilename(),
				PreviousPath: f.GetPreviousFilename(),
				Ref:          ref,
				PreviousRef:  base,
				Action:       FileActionRenamed,
			})
		case "removed":
			changes = append(changes, VersionedFileChange{
				Ref:    base,
				Path:   f.GetFilename(),
				Action: FileActionDeleted,
			})
		case "unchanged":
			// do nothing
		default:
			logger.Error("ignore unhandled file", "file", f.GetFilename(), "status", f.GetStatus())
		}
	}

	return changes, nil
}

func (r *githubRepository) shouldLintPullRequest() bool {
	// TODO: Figure out how we want to determine this in practice.
	val, ok := os.LookupEnv("GRAFANA_LINTING")
	return ok && val == "true"
}

// ClearAllPullRequestFileComments clears all comments on a pull request
func (r *githubRepository) ClearAllPullRequestFileComments(ctx context.Context, prNumber int) error {
	ctx, _ = r.logger(ctx, "")
	return r.gh.ClearAllPullRequestFileComments(ctx, r.owner, r.repo, prNumber)
}

// CommentPullRequest adds a comment to a pull request.
func (r *githubRepository) CommentPullRequest(ctx context.Context, prNumber int, comment string) error {
	ctx, _ = r.logger(ctx, "")
	return r.gh.CreatePullRequestComment(ctx, r.owner, r.repo, prNumber, comment)
}

// CommentPullRequestFile lints a file and comments the issues found.
func (r *githubRepository) CommentPullRequestFile(ctx context.Context, prNumber int, path, ref, comment string) error {
	ctx, _ = r.logger(ctx, ref)
	fileComment := pgh.FileComment{
		Content:  comment,
		Path:     path,
		Position: 1, // create a top-level comment
		Ref:      ref,
	}

	// FIXME: comment with Grafana Logo
	// FIXME: comment author should be written by Grafana and not the user
	return r.gh.CreatePullRequestFileComment(ctx, r.owner, r.repo, prNumber, fileComment)
}

func (r *githubRepository) createWebhook(ctx context.Context) (pgh.WebhookConfig, error) {
	secret, err := uuid.NewRandom()
	if err != nil {
		return pgh.WebhookConfig{}, fmt.Errorf("could not generate secret: %w", err)
	}

	cfg := pgh.WebhookConfig{
		URL:         r.webhookURL,
		Secret:      secret.String(),
		ContentType: "json",
		Events:      subscribedEvents,
		Active:      true,
	}

	hook, err := r.gh.CreateWebhook(ctx, r.owner, r.repo, cfg)
	if err != nil {
		return pgh.WebhookConfig{}, err
	}

	// HACK: GitHub does not return the secret, so we need to update it manually
	hook.Secret = cfg.Secret

	logging.FromContext(ctx).Info("webhook created", "url", cfg.URL, "id", hook.ID)
	return hook, nil
}

// updateWebhook checks if the webhook needs to be updated and updates it if necessary.
// if the webhook does not exist, it will create it.
func (r *githubRepository) updateWebhook(ctx context.Context) (pgh.WebhookConfig, bool, error) {
	if r.config.Status.Webhook == nil || r.config.Status.Webhook.ID == 0 {
		hook, err := r.createWebhook(ctx)
		if err != nil {
			return pgh.WebhookConfig{}, false, err
		}
		return hook, true, nil
	}

	hook, err := r.gh.GetWebhook(ctx, r.owner, r.repo, r.config.Status.Webhook.ID)
	switch {
	case errors.Is(err, pgh.ErrResourceNotFound):
		hook, err := r.createWebhook(ctx)
		if err != nil {
			return pgh.WebhookConfig{}, false, err
		}
		return hook, true, nil
	case err != nil:
		return pgh.WebhookConfig{}, false, fmt.Errorf("get webhook: %w", err)
	}

	hook.Secret = r.config.Status.Webhook.Secret // we always random gen this, so don't use it for mustUpdate below.

	var mustUpdate bool

	if hook.URL != r.config.Status.Webhook.URL {
		mustUpdate = true
		hook.URL = r.webhookURL
	}

	if !slices.Equal(hook.Events, subscribedEvents) {
		mustUpdate = true
		hook.Events = subscribedEvents
	}

	if !mustUpdate {
		return hook, false, nil
	}

	// Something has changed in the webhook. Let's rotate the secret as well, so as to ensure we end up with a 100% correct webhook.
	secret, err := uuid.NewRandom()
	if err != nil {
		return pgh.WebhookConfig{}, false, fmt.Errorf("could not generate secret: %w", err)
	}
	hook.Secret = secret.String()

	if err := r.gh.EditWebhook(ctx, r.owner, r.repo, hook); err != nil {
		return pgh.WebhookConfig{}, false, fmt.Errorf("edit webhook: %w", err)
	}

	return hook, true, nil
}

func (r *githubRepository) deleteWebhook(ctx context.Context) error {
	if r.config.Status.Webhook == nil {
		return fmt.Errorf("webhook not found")
	}

	id := r.config.Status.Webhook.ID

	if err := r.gh.DeleteWebhook(ctx, r.owner, r.repo, id); err != nil {
		return fmt.Errorf("delete webhook: %w", err)
	}

	logging.FromContext(ctx).Info("webhook deleted", "url", r.config.Status.Webhook.URL, "id", id)
	return nil
}

func (r *githubRepository) OnCreate(ctx context.Context) (*provisioning.WebhookStatus, error) {
	ctx, _ = r.logger(ctx, "")
	hook, err := r.createWebhook(ctx)
	if err != nil {
		return nil, err
	}

	return &provisioning.WebhookStatus{
		ID:               hook.ID,
		URL:              hook.URL,
		Secret:           hook.Secret,
		SubscribedEvents: hook.Events,
	}, nil
}

func (r *githubRepository) OnUpdate(ctx context.Context) (*provisioning.WebhookStatus, error) {
	ctx, _ = r.logger(ctx, "")
	hook, _, err := r.updateWebhook(ctx)
	if err != nil {
		return nil, err
	}

	return &provisioning.WebhookStatus{
		ID:               hook.ID,
		URL:              hook.URL,
		Secret:           hook.Secret,
		SubscribedEvents: hook.Events,
	}, nil
}

func (r *githubRepository) OnDelete(ctx context.Context) error {
	ctx, _ = r.logger(ctx, "")
	return r.deleteWebhook(ctx)
}

func (r *githubRepository) logger(ctx context.Context, ref string) (context.Context, logging.Logger) {
	logger := logging.FromContext(ctx)

	type containsGh int
	var containsGhKey containsGh
	if ctx.Value(containsGhKey) != nil {
		return ctx, logging.FromContext(ctx)
	}

	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	logger = logger.With(slog.Group("github_repository", "owner", r.owner, "name", r.repo, "ref", ref))
	ctx = logging.Context(ctx, logger)
	// We want to ensure we don't add multiple github_repository keys. With doesn't deduplicate the keys...
	ctx = context.WithValue(ctx, containsGhKey, true)
	return ctx, logger
}
