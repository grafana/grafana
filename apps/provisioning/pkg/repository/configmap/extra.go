package configmap

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

type extra struct {
	clients ClientProvider
}

// Extra registers the configmap repository type.
func Extra(clients ClientProvider) repository.Extra {
	if clients == nil {
		clients = InClusterClientProvider()
	}
	return &extra{clients: clients}
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.ConfigMapRepositoryType
}

func (e *extra) Build(_ context.Context, r *provisioning.Repository) (repository.Repository, error) {
	return NewRepository(r, e.clients), nil
}

func (e *extra) Mutate(_ context.Context, _ runtime.Object) error {
	return nil
}

func (e *extra) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return Validate(ctx, obj)
}
