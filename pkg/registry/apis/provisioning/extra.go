package provisioning

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
)

type Extra interface {
	Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error)
	Mutate(ctx context.Context, r *provisioning.Repository) error
	UpdateStorage(storage map[string]rest.Storage) error
	PostProcessOpenAPI(oas *spec3.OpenAPI) error
	GetJobWorkers() []jobs.Worker
	AsRepository(ctx context.Context, r *provisioning.Repository) (repository.Repository, error)
}

type ExtraBuilder func(b *APIBuilder) Extra
