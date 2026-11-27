package provisioning

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
)

type Extra interface {
	Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error)
	UpdateStorage(storage map[string]rest.Storage) error
	PostProcessOpenAPI(oas *spec3.OpenAPI) error
}

// V1beta2Extra is an Extra that v1beta2 serves too: its Authorize applies to v1beta2 requests, and
// every storage it adds must be a v0alpha1 connector, which v1beta2 serves converted. Its
// PostProcessOpenAPI only applies to the version it was built for.
type V1beta2Extra interface {
	Extra
	ServedOnV1beta2()
}

type ExtraBuilder func(b *APIBuilder) Extra
