package provisioning

import (
	"context"

	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// RepositoryLister interface for listing repositories.
// Deprecated: Use repository.RepositoryLister instead.
type RepositoryLister = repository.RepositoryLister

// GetRepositoriesInNamespace retrieves all repositories in a given namespace.
// Deprecated: Use repository.GetRepositoriesInNamespace instead.
func GetRepositoriesInNamespace(ctx context.Context, store RepositoryLister) ([]provisioning.Repository, error) {
	return repository.GetRepositoriesInNamespace(ctx, store)
}

// VerifyAgainstExistingRepositories validates a repository configuration against existing repositories.
// Deprecated: Use repository.VerifyAgainstExisting instead.
func VerifyAgainstExistingRepositories(ctx context.Context, store RepositoryLister, cfg *provisioning.Repository) *field.Error {
	return repository.VerifyAgainstExisting(ctx, store, cfg)
}
