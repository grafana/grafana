package nanogit

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

// githubRepository is a repository implementation that integrates both a GitHub API-backed repository and a nanogit-based repository.
// It combines the features of the GitHub API with those of a standard Git repository.
// This is an interim solution to support both backends within a single repository abstraction.
// Once nanogit is fully integrated, functionality from GithubRepository should be migrated here, and this type should extend the nanogit.GitRepository interface.
type githubRepository struct {
	apiRepo     repository.GithubRepository
	nanogitRepo repository.GitRepository
}

func NewGithubRepository(
	apiRepo repository.GithubRepository,
	nanogitRepo repository.GitRepository,
) repository.GithubRepository {
	return &githubRepository{
		apiRepo:     apiRepo,
		nanogitRepo: nanogitRepo,
	}
}

func (r *githubRepository) Config() *provisioning.Repository {
	return r.nanogitRepo.Config()
}

func (r *githubRepository) Owner() string {
	return r.apiRepo.Owner()
}

func (r *githubRepository) Repo() string {
	return r.apiRepo.Repo()
}

func (r *githubRepository) Client() pgh.Client {
	return r.apiRepo.Client()
}

// Validate extends the nanogit repo validation with github specific validation
func (r *githubRepository) Validate() (list field.ErrorList) {
	cfg := r.nanogitRepo.Config()
	gh := cfg.Spec.GitHub
	if gh == nil {
		list = append(list, field.Required(field.NewPath("spec", "github"), "a github config is required"))
		return list
	}
	if gh.URL == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "url"), "a github url is required"))
	} else {
		_, _, err := repository.ParseOwnerRepoGithub(gh.URL)
		if err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, err.Error()))
		} else if !strings.HasPrefix(gh.URL, "https://github.com/") {
			list = append(list, field.Invalid(field.NewPath("spec", "github", "url"), gh.URL, "URL must start with https://github.com/"))
		}
	}

	if len(list) > 0 {
		return list
	}

	return r.nanogitRepo.Validate()
}

// Test implements provisioning.Repository.
func (r *githubRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return r.apiRepo.Test(ctx)
}

// ReadResource implements provisioning.Repository.
func (r *githubRepository) Read(ctx context.Context, filePath, ref string) (*repository.FileInfo, error) {
	return r.nanogitRepo.Read(ctx, filePath, ref)
}

func (r *githubRepository) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	return r.nanogitRepo.ReadTree(ctx, ref)
}

func (r *githubRepository) Create(ctx context.Context, path, ref string, data []byte, comment string) error {
	return r.nanogitRepo.Create(ctx, path, ref, data, comment)
}

func (r *githubRepository) Update(ctx context.Context, path, ref string, data []byte, comment string) error {
	return r.nanogitRepo.Update(ctx, path, ref, data, comment)
}

func (r *githubRepository) Write(ctx context.Context, path string, ref string, data []byte, message string) error {
	return r.nanogitRepo.Write(ctx, path, ref, data, message)
}

func (r *githubRepository) Delete(ctx context.Context, path, ref, comment string) error {
	return r.nanogitRepo.Delete(ctx, path, ref, comment)
}

func (r *githubRepository) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	// Github API provides avatar URLs which nanogit does not, so we delegate to the github repo.
	return r.apiRepo.History(ctx, path, ref)
}

func (r *githubRepository) LatestRef(ctx context.Context) (string, error) {
	return r.nanogitRepo.LatestRef(ctx)
}

func (r *githubRepository) CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error) {
	return r.nanogitRepo.CompareFiles(ctx, base, ref)
}

// ResourceURLs implements RepositoryWithURLs.
func (r *githubRepository) ResourceURLs(ctx context.Context, file *repository.FileInfo) (*provisioning.ResourceURLs, error) {
	return r.apiRepo.ResourceURLs(ctx, file)
}

func (r *githubRepository) Clone(ctx context.Context, opts repository.CloneOptions) (repository.ClonedRepository, error) {
	return r.nanogitRepo.Clone(ctx, opts)
}
