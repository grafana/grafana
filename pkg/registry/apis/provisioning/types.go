package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type RepoGetter interface {
	// This gets a repository with the provided name in the namespace from ctx
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}
