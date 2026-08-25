package appplugin

import (
	"net/http"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-app-sdk/plugin/httpadapter"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

func (b *AppPluginAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	if b.manifest == nil {
		return nil
	}

	handler := func(w http.ResponseWriter, r *http.Request) {
		c, ok := b.clientV3(r.Context())
		if !ok {
			http.Error(w, "no backend configured", 500)
			return
		}
		routeClient, ok := c.(pluginv3.RouteServiceClient)
		if !ok {
			http.Error(w, "backend does not support routes", 500)
			return
		}
		httpadapter.HandlerFunc(routeClient).ServeHTTP(w, r)
	}

	for _, version := range b.manifest.Versions {
		if version.Name != gv.Version {
			continue
		}

		routes := &builder.APIRoutes{}
		for path, props := range version.Routes.Cluster {
			routes.Root = append(routes.Root, builder.APIRouteHandler{
				Path:    strings.TrimPrefix(path, "/"),
				Spec:    &props,
				Schemas: version.Routes.Schemas,
				Handler: handler,
			})
		}

		for path, props := range version.Routes.Namespaced {
			routes.Namespace = append(routes.Namespace, builder.APIRouteHandler{
				Path:    strings.TrimPrefix(path, "/"),
				Spec:    &props,
				Schemas: version.Routes.Schemas,
				Handler: handler,
			})
		}

		return routes
	}

	return nil
}
