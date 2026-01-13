package provisioning

import (
	"context"

	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

type RepoGetter interface {
	// This gets a repository with the provided name in the namespace from ctx
	GetRepository(ctx context.Context, name string) (repository.Repository, error)

	// This will return a healthy repository, or an error saying the repository is not healthy
	GetHealthyRepository(ctx context.Context, name string) (repository.Repository, error)
}

type ConnectionGetter interface {
	// This gets a connection with the provided name in the namespace from ctx
	GetConnection(ctx context.Context, name string) (connection.Connection, error)
}

type ClientGetter interface {
	GetClient() client.ProvisioningV0alpha1Interface
}
