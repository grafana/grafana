package nanogithub

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/nanogit"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

// NanoGithubRepository is a repository implementation that integrates both a GitHub API-backed repository and a nanogit-based repository.
// It combines the features of the GitHub API with those of a standard Git repository.
// This is an interim solution to support both backends within a single repository abstraction.
// Once nanogit is fully integrated, functionality from GithubRepository should be migrated here, and this type should extend the nanogit.GitRepository interface.
type NanoGithubRepository struct {
	githubRepo  repository.GithubRepository
	nanogitRepo nanogit.GitRepository
}

func NewNanoGithubRepository(
	githubRepo repository.GithubRepository,
	nanogitRepo nanogit.GitRepository,
) repository.GithubRepository {
	return &NanoGithubRepository{
		githubRepo:  githubRepo,
		nanogitRepo: nanogitRepo,
	}
}

func (r *NanoGithubRepository) Config() *provisioning.Repository {
	return r.nanogitRepo.Config()
}

func (r *NanoGithubRepository) Owner() string {
	return r.githubRepo.Owner()
}

func (r *NanoGithubRepository) Repo() string {
	return r.githubRepo.Repo()
}

func (r *NanoGithubRepository) Client() pgh.Client {
	return r.githubRepo.Client()
}

func (r *NanoGithubRepository) Validate() (list field.ErrorList) {
	return r.nanogitRepo.Validate()
}

// Test implements provisioning.Repository.
func (r *NanoGithubRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return r.githubRepo.Test(ctx)
}

// ReadResource implements provisioning.Repository.
func (r *NanoGithubRepository) Read(ctx context.Context, filePath, ref string) (*repository.FileInfo, error) {
	return r.nanogitRepo.Read(ctx, filePath, ref)
}

func (r *NanoGithubRepository) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	return r.nanogitRepo.ReadTree(ctx, ref)
}

func (r *NanoGithubRepository) Create(ctx context.Context, path, ref string, data []byte, comment string) error {
	return r.nanogitRepo.Create(ctx, path, ref, data, comment)
}

func (r *NanoGithubRepository) Update(ctx context.Context, path, ref string, data []byte, comment string) error {
	return r.nanogitRepo.Update(ctx, path, ref, data, comment)
}

func (r *NanoGithubRepository) Write(ctx context.Context, path string, ref string, data []byte, message string) error {
	return r.nanogitRepo.Write(ctx, path, ref, data, message)
}

func (r *NanoGithubRepository) Delete(ctx context.Context, path, ref, comment string) error {
	return r.nanogitRepo.Delete(ctx, path, ref, comment)
}

func (r *NanoGithubRepository) History(ctx context.Context, path, ref string) ([]provisioning.HistoryItem, error) {
	// Github API provides avatar URLs which nanogit does not, so we delegate to the github repo.
	return r.githubRepo.History(ctx, path, ref)
}

func (r *NanoGithubRepository) LatestRef(ctx context.Context) (string, error) {
	return r.nanogitRepo.LatestRef(ctx)
}

func (r *NanoGithubRepository) CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error) {
	return r.nanogitRepo.CompareFiles(ctx, base, ref)
}

// ResourceURLs implements RepositoryWithURLs.
func (r *NanoGithubRepository) ResourceURLs(ctx context.Context, file *repository.FileInfo) (*provisioning.ResourceURLs, error) {
	return r.githubRepo.ResourceURLs(ctx, file)
}

func (r *NanoGithubRepository) Clone(ctx context.Context, opts repository.CloneOptions) (repository.ClonedRepository, error) {
	return r.nanogitRepo.Clone(ctx, opts)
}
