package github

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

// Make sure all public functions of this struct call the (*githubRepository).logger function, to ensure the GH repo details are included.
type githubRepository struct {
	gitRepo repository.GitRepository
	config  *provisioning.Repository
	gh      Client // assumes github.com base URL

	owner string
	repo  string
}

// GithubRepository is an interface that combines all repository capabilities
// needed for GitHub repositories.

//go:generate mockery --name GithubRepository --structname MockGithubRepository --inpackage --filename github_repository_mock.go --with-expecter
type GithubRepository interface {
	repository.Repository
	repository.Versioned
	repository.Writer
	repository.Reader
	repository.RepositoryWithURLs
	repository.ClonableRepository
	Owner() string
	Repo() string
	Client() Client
}

func NewGitHub(
	ctx context.Context,
	config *provisioning.Repository,
	gitRepo repository.GitRepository,
	factory *Factory,
	secrets secrets.Service,
) (GithubRepository, error) {
	owner, repo, err := ParseOwnerRepoGithub(config.Spec.GitHub.URL)
	if err != nil {
		return nil, fmt.Errorf("parse owner and repo: %w", err)
	}

	// TODO: we are decrypting twice. Once for git and once for GH.
	token := config.Spec.GitHub.Token
	if token == "" {
		decrypted, err := secrets.Decrypt(ctx, config.Spec.GitHub.EncryptedToken)
		if err != nil {
			return nil, fmt.Errorf("decrypt token: %w", err)
		}
		token = string(decrypted)
	}

	return &githubRepository{
		config:  config,
		gitRepo: gitRepo,
		gh:      factory.New(ctx, token), // TODO, baseURL from config
		owner:   owner,
		repo:    repo,
	}, nil
}

func (r *githubRepository) Config() *provisioning.Repository {
	return r.gitRepo.Config()
}

func (r *githubRepository) Owner() string {
	return r.owner
}

func (r *githubRepository) Repo() string {
	return r.repo
}

func (r *githubRepository) Client() Client {
	return r.gh
}

// Validate implements provisioning.Repository.
func (r *githubRepository) Validate() (list field.ErrorList) {
	cfg := r.gitRepo.Config()
	gh := cfg.Spec.GitHub
	if gh == nil {
		list = append(list, field.Required(field.NewPath("spec", "github"), "a github config is required"))
		return list
	}
	if gh.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "url"), "a github url is required"))
	} else {
		_, _, err := ParseOwnerRepoGithub(gh.URL)
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, err.Error()))
		} else if !strings.HasPrefix(gh.URL, "https://github.com/") {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, "URL must start with https://github.com/"))
		}
	}

	if len(list) > 0 {
		return list
	}

	return r.gitRepo.Validate()
}

func ParseOwnerRepoGithub(giturl string) (owner string, repo string, err error) {
	parsed, e := url.Parse(strings.TrimSuffix(giturl, ".git"))
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
		return &provisioning.TestResults{
			Code:    http.StatusBadRequest,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("spec", "github", "token").String(),
				Detail: err.Error(),
			}}}, nil
	}

	url := r.config.Spec.GitHub.URL
	owner, repo, err := ParseOwnerRepoGithub(url)
	if err != nil {
		return repository.FromFieldError(field.Invalid(
			field.NewPath("spec", "github", "url"), url, err.Error())), nil
	}

	// FIXME: check token permissions
	ok, err := r.gh.RepoExists(ctx, owner, repo)
	if err != nil {
		return repository.FromFieldError(field.Invalid(
			field.NewPath("spec", "github", "url"), url, err.Error())), nil
	}

	if !ok {
		return repository.FromFieldError(field.NotFound(
			field.NewPath("spec", "github", "url"), url)), nil
	}

	branch := r.config.Spec.GitHub.Branch
	ok, err = r.gh.BranchExists(ctx, r.owner, r.repo, branch)
	if err != nil {
		return repository.FromFieldError(field.Invalid(
			field.NewPath("spec", "github", "branch"), branch, err.Error())), nil
	}

	if !ok {
		return repository.FromFieldError(field.NotFound(
			field.NewPath("spec", "github", "branch"), branch)), nil
	}

	return &provisioning.TestResults{
		Code:    http.StatusOK,
		Success: true,
	}, nil
}

// ReadResource implements provisioning.Repository.
func (r *githubRepository) Read(ctx context.Context, filePath, ref string) (*repository.FileInfo, error) {
	return r.gitRepo.Read(ctx, filePath, ref)
}

func (r *githubRepository) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	return r.gitRepo.ReadTree(ctx, ref)
}

func (r *githubRepository) Create(ctx context.Context, path, ref string, data []byte, comment string) error {
	return r.gitRepo.Create(ctx, path, ref, data, comment)
}

func (r *githubRepository) Update(ctx context.Context, path, ref string, data []byte, comment string) error {
	return r.gitRepo.Update(ctx, path, ref, data, comment)
}

func (r *githubRepository) Write(ctx context.Context, path string, ref string, data []byte, message string) error {
	return r.gitRepo.Write(ctx, path, ref, data, message)
}

func (r *githubRepository) Delete(ctx context.Context, path, ref, comment string) error {
	return r.gitRepo.Delete(ctx, path, ref, comment)
}

func (r *githubRepository) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}
	ctx, _ = r.logger(ctx, ref)

	finalPath := safepath.Join(r.config.Spec.GitHub.Path, path)
	commits, err := r.gh.Commits(ctx, r.owner, r.repo, finalPath, ref)
	if err != nil {
		if errors.Is(err, ErrResourceNotFound) {
			return nil, repository.ErrFileNotFound
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

func (r *githubRepository) ensureBranchExists(ctx context.Context, branchName string) error {
	if !git.IsValidGitBranchName(branchName) {
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
		if errors.Is(err, ErrResourceAlreadyExists) {
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

func (r *githubRepository) LatestRef(ctx context.Context) (string, error) {
	return r.gitRepo.LatestRef(ctx)
}

func (r *githubRepository) CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error) {
	return r.gitRepo.CompareFiles(ctx, base, ref)
}

// ResourceURLs implements RepositoryWithURLs.
func (r *githubRepository) ResourceURLs(ctx context.Context, file *repository.FileInfo) (*provisioning.ResourceURLs, error) {
	cfg := r.config.Spec.GitHub
	if file.Path == "" || cfg == nil {
		return nil, nil
	}

	ref := file.Ref
	if ref == "" {
		ref = cfg.Branch
	}

	urls := &provisioning.ResourceURLs{
		RepositoryURL: cfg.URL,
		SourceURL:     fmt.Sprintf("%s/blob/%s/%s", cfg.URL, ref, file.Path),
	}

	if ref != cfg.Branch {
		urls.CompareURL = fmt.Sprintf("%s/compare/%s...%s", cfg.URL, cfg.Branch, ref)

		// Create a new pull request
		urls.NewPullRequestURL = fmt.Sprintf("%s?quick_pull=1&labels=grafana", urls.CompareURL)
	}

	return urls, nil
}

// TODO: we should not need to clone
func (r *githubRepository) Clone(ctx context.Context, opts repository.CloneOptions) (repository.ClonedRepository, error) {
	return r.gitRepo.Clone(ctx, opts)
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
