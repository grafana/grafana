package provisioning

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type RepoGetter interface {
	// This gets a repository with the provided name in the namespace from ctx
	GetRepository(ctx context.Context, name string) (repository.Repository, error)

	// This will return a healthy repository, or an error saying the repository is not healthy
	GetHealthyRepository(ctx context.Context, name string) (repository.Repository, error)

	// Given a repository configuration, return it as a repository instance
	// This will only error for un-recoverable system errors
	// the repository instance may or may not be valid/healthy
	AsRepository(ctx context.Context, cfg *provisioning.Repository) (repository.Repository, error)
}

type ClientGetter interface {
	GetClient() client.ProvisioningV0alpha1Interface
}
