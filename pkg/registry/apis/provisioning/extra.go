package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
)

type Extra interface {
	Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error)
	UpdateStorage(storage map[string]rest.Storage) error
	PostProcessOpenAPI(oas *spec3.OpenAPI) error
	GetJobWorkers() []jobs.Worker
	// FIXME: Clean up as soon as https://github.com/grafana/grafana/pull/109908 is merged
	Mutators() []controller.Mutator
}

type ExtraBuilder func(b *APIBuilder) Extra
