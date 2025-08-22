package local

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/runtime"
)

type extra struct {
	resolver *LocalFolderResolver
}

func Extra(cfg *setting.Cfg) repository.Extra {
	resolver := &LocalFolderResolver{
		PermittedPrefixes: cfg.PermittedProvisioningPaths,
		HomePath:          safepath.Clean(cfg.HomePath),
	}

	return &extra{resolver: resolver}
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.LocalRepositoryType
}

func (e *extra) Build(_ context.Context, r *provisioning.Repository) (repository.Repository, error) {
	return NewLocal(r, e.resolver), nil
}

func (e *extra) Mutate(_ context.Context, _ runtime.Object) error {
	return nil
}
