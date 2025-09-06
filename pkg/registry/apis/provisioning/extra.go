package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
)

type Extra interface {
	Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error)
	UpdateStorage(storage map[string]rest.Storage) error
	PostProcessOpenAPI(oas *spec3.OpenAPI) error
}

type JobsWorkerRetriever interface {
	GetJobWorkers() []jobs.Worker
}

type ExtraBuilder func(b *APIBuilder) Extra
