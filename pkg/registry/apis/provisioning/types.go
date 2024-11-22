package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}
