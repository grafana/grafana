package appplugin

import (
	"encoding/json"
	"net/http"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

func (b *AppPluginAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	if b.manifest == nil {
		return nil
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
				Handler: func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(map[string]any{
						"cluster": path,
						"method":  r.Method,
						"path":    r.URL.Path,
						"query":   r.URL.RawQuery,
					})
				},
			})
		}

		for path, props := range version.Routes.Namespaced {
			routes.Namespace = append(routes.Namespace, builder.APIRouteHandler{
				Path:    strings.TrimPrefix(path, "/"),
				Spec:    &props,
				Schemas: version.Routes.Schemas,
				Handler: func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					_ = json.NewEncoder(w).Encode(map[string]any{
						"namespaced": path,
						"method":     r.Method,
						"path":       r.URL.Path,
						"query":      r.URL.RawQuery,
					})
				},
			})
		}

		return routes
	}

	return nil
}
