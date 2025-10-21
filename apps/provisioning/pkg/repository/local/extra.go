package local

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"k8s.io/apimachinery/pkg/runtime"
)

type extra struct {
	resolver *LocalFolderResolver
}

func Extra(homePath string, permittedPrefixes []string) repository.Extra {
	resolver := &LocalFolderResolver{
		PermittedPrefixes: permittedPrefixes,
		HomePath:          safepath.Clean(homePath),
	}

	return &extra{resolver: resolver}
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.LocalRepositoryType
}

func (e *extra) Build(_ context.Context, r *provisioning.Repository) (repository.Repository, error) {
	return NewRepository(r, e.resolver), nil
}

func (e *extra) Mutate(_ context.Context, _ runtime.Object) error {
	return nil
}
