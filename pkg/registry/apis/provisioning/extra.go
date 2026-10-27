package provisioning

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	provisioningapp "github.com/grafana/grafana/apps/provisioning/pkg/app"
)

type Extra interface {
	Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error)
	UpdateStorage(storage map[string]rest.Storage) error
	PostProcessOpenAPI(oas *spec3.OpenAPI) error
}

type ExtraBuilder func(b *APIBuilder) Extra

// ExtraRoutes is implemented by extras that add subresource connectors in UpdateStorage,
// so the app installer can route them.
type ExtraRoutes interface {
	SubresourceRoutes() []provisioningapp.Route
}

// ExtraSubresourceRoutes returns the subresource routes the extras add.
func (b *APIBuilder) ExtraSubresourceRoutes() []provisioningapp.Route {
	var routes []provisioningapp.Route
	for _, extra := range b.extras {
		if r, ok := extra.(ExtraRoutes); ok {
			routes = append(routes, r.SubresourceRoutes()...)
		}
	}
	return routes
}
