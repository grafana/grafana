package kindstore

import (
	"maps"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
)

// OpenAPIName is the key a kind's schema is published and looked up under.
func OpenAPIName(gvk schema.GroupVersionKind) string {
	return gvk.Group + "." + gvk.Version + "." + gvk.Kind
}

// LoadOpenAPIDefinitions loads schemas for all served kinds, keyed by the group
// the plugin is served under. That is not always the manifest's own group: a
// manifest that declares none is served under the plugin id, and a definition
// keyed any other way is one no kind can find. The caller decides which group that is.
func LoadOpenAPIDefinitions(ref common.ReferenceCallback, group string, manifest *app.ManifestData) map[string]common.OpenAPIDefinition {
	defs := map[string]common.OpenAPIDefinition{}
	if manifest == nil {
		return defs
	}
	for _, version := range manifest.Versions {
		if !version.Served {
			continue
		}

		prefix := group + "." + version.Name
		for _, kind := range version.Kinds {
			if kind.Schema == nil {
				continue
			}
			gvk := schema.GroupVersionKind{
				Group:   group,
				Version: version.Name,
				Kind:    kind.Kind,
			}
			k, err := kind.Schema.AsKubeOpenAPI(gvk, ref, prefix)
			if err != nil {
				logging.DefaultLogger.Error("invalid manifest kind schema; the kind will be missing from the OpenAPI spec",
					"gvk", gvk.String(), "error", err)
				continue
			}
			maps.Copy(defs, k)
		}
	}
	return defs
}
