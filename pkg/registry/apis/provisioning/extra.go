package provisioning

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type Extra interface {
	Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error)
	UpdateStorage(storage map[string]rest.Storage) error
	PostProcessOpenAPI(oas *spec3.OpenAPI) error
	GetJobWorkers() []jobs.Worker
	AsRepository(ctx context.Context, r *provisioning.Repository, secure repository.SecureValues) (repository.Repository, error)
	RepositoryTypes() []provisioning.RepositoryType
	Mutators() []controller.Mutator
}

type ExtraBuilder func(b *APIBuilder) Extra
