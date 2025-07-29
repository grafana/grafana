package github

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

//nolint:gosec // This is a constant for a secret suffix
const githubTokenSecretSuffix = "-github-token"

// Make sure all public functions of this struct call the (*githubRepository).logger function, to ensure the GH repo details are included.
type githubRepository struct {
	git.GitRepository
	config  *provisioning.Repository
	gh      Client // assumes github.com base URL
	secrets secrets.RepositorySecrets

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
	repository.StageableRepository
	repository.Hooks
	Owner() string
	Repo() string
	Client() Client
}

func NewGitHub(
	ctx context.Context,
	config *provisioning.Repository,
	gitRepo git.GitRepository,
	factory *Factory,
	token string,
	secrets secrets.RepositorySecrets,
) (GithubRepository, error) {
	owner, repo, err := ParseOwnerRepoGithub(config.Spec.GitHub.URL)
	if err != nil {
		return nil, fmt.Errorf("parse owner and repo: %w", err)
	}

	return &githubRepository{
		config:        config,
		GitRepository: gitRepo,
		gh:            factory.New(ctx, token), // TODO, baseURL from config
		owner:         owner,
		repo:          repo,
		secrets:       secrets,
	}, nil
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
	cfg := r.Config()
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

	return r.GitRepository.Validate()
}

func ParseOwnerRepoGithub(giturl string) (owner string, repo string, err error) {
	giturl = strings.TrimSuffix(giturl, ".git")
	giturl = strings.TrimSuffix(giturl, "/")

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
	url := r.config.Spec.GitHub.URL
	_, _, err := ParseOwnerRepoGithub(url)
	if err != nil {
		return repository.FromFieldError(field.Invalid(
			field.NewPath("spec", "github", "url"), url, err.Error())), nil
	}

	return r.GitRepository.Test(ctx)
}

func (r *githubRepository) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

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

// ListRefs list refs from the git repository and add the ref URL to the ref item
func (r *githubRepository) ListRefs(ctx context.Context) ([]provisioning.RefItem, error) {
	refs, err := r.GitRepository.ListRefs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list refs: %w", err)
	}

	for i := range refs {
		refs[i].RefURL = fmt.Sprintf("%s/tree/%s", r.config.Spec.GitHub.URL, refs[i].Name)
	}

	return refs, nil
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

func (r *githubRepository) OnCreate(_ context.Context) ([]map[string]interface{}, error) {
	return nil, nil
}

func (r *githubRepository) OnUpdate(_ context.Context) ([]map[string]interface{}, error) {
	return nil, nil
}

func (r *githubRepository) OnDelete(ctx context.Context) error {
	logger := logging.FromContext(ctx)
	secretName := r.config.Name + githubTokenSecretSuffix
	if err := r.secrets.Delete(ctx, r.config, secretName); err != nil {
		return fmt.Errorf("delete github token secret: %w", err)
	}

	logger.Info("Deleted github token secret", "secretName", secretName)

	return nil
}
