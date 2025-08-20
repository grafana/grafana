package provisioning

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
)

type Extra interface {
	Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error)
	UpdateStorage(storage map[string]rest.Storage) error
	PostProcessOpenAPI(oas *spec3.OpenAPI) error
	GetJobWorkers() []jobs.Worker
	AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error)
	RepositoryTypes() []provisioning.RepositoryType
	Mutators() []controller.Mutator
}

type ExtraBuilder func(b *APIBuilder) Extra

// NoopExtra is a no-op implementation of the Extra interface
// used when specific functionality is not available (e.g., webhooks for non-public URLs)
type NoopExtra struct{}

func NewNoopExtra() *NoopExtra {
	return &NoopExtra{}
}

// Authorize always returns no opinion for no-op extra
func (e *NoopExtra) Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
	return authorizer.DecisionNoOpinion, "", nil
}

// Mutators returns empty list for no-op extra
func (e *NoopExtra) Mutators() []controller.Mutator {
	return []controller.Mutator{}
}

// UpdateStorage is a no-op for no-op extra
func (e *NoopExtra) UpdateStorage(storage map[string]rest.Storage) error {
	return nil
}

// PostProcessOpenAPI is a no-op for no-op extra
func (e *NoopExtra) PostProcessOpenAPI(oas *spec3.OpenAPI) error {
	return nil
}

// GetJobWorkers returns empty list for no-op extra
func (e *NoopExtra) GetJobWorkers() []jobs.Worker {
	return []jobs.Worker{}
}

// AsRepository returns nil for no-op extra (no custom repository handling)
func (e *NoopExtra) AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	return nil, nil
}

// RepositoryTypes returns empty list for no-op extra
func (e *NoopExtra) RepositoryTypes() []provisioning.RepositoryType {
	return []provisioning.RepositoryType{}
}
