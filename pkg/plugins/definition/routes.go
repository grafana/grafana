package definition

import (
	"maps"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
)

// namespacedRoutePrefix is the version-relative path namespaced routes mount
// under.
const namespacedRoutePrefix = "/namespaces/{namespace}"

// MigrateDeprecatedRoutes moves each version's deprecated Routes into its
// OpenAPI paths, so a manifest written before app-sdk published routes there
// is served the same way as one written after. Routes is cleared, since the
// OpenAPI paths are authoritative once they exist.
//
// A version without OpenAPI paths gets its routes the way app-sdk codegen
// writes them: cluster routes at the version root, namespaced routes under the
// namespace, and each kind's routes under one of its objects. Route schemas
// are added to the OpenAPI components, which win over them.
func MigrateDeprecatedRoutes(manifest *app.ManifestData) {
	if manifest == nil {
		return
	}
	for i := range manifest.Versions {
		migrateVersionRoutes(&manifest.Versions[i])
	}
}

func migrateVersionRoutes(version *app.ManifestVersion) {
	legacy := version.Routes                     //nolint:staticcheck // SA1019: this is where the deprecated routes are migrated.
	version.Routes = app.ManifestVersionRoutes{} //nolint:staticcheck // SA1019: as above.
	if len(version.OpenAPI.Paths) > 0 {
		return
	}

	paths := map[string]spec3.PathProps{}
	add := func(prefix string, routes map[string]spec3.PathProps) {
		for path, props := range routes {
			paths[prefix+"/"+strings.TrimPrefix(path, "/")] = props
		}
	}
	add("", legacy.Cluster)
	add(namespacedRoutePrefix, legacy.Namespaced)
	for i := range version.Kinds {
		kind := &version.Kinds[i]
		prefix := "/" + kind.Resource() + "/{name}"
		if kind.Scope != "Cluster" {
			prefix = namespacedRoutePrefix + prefix
		}
		add(prefix, kind.Routes)
	}
	if len(paths) > 0 {
		version.OpenAPI.Paths = paths
	}

	if len(legacy.Schemas) > 0 {
		schemas := maps.Clone(legacy.Schemas)
		maps.Copy(schemas, version.OpenAPI.Components.Schemas)
		version.OpenAPI.Components.Schemas = schemas
	}
}
