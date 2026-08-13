package search

import (
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/util"
	"k8s.io/kube-openapi/pkg/validation/spec"

	commonv0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
)

// Go names, because that is how the generated definitions are keyed.
const (
	envelopePkg         = "github.com/grafana/grafana/pkg/apis/search/v0alpha1."
	searchQueryGoName   = envelopePkg + searchv0.KindSearchQuery
	searchResultsGoName = envelopePkg + searchv0.KindSearchResults
)

// componentPrefix is where an OpenAPI v3 document keeps its schemas.
const componentPrefix = "#/components/schemas/"

// friendly is the component name for a definition. Generated dependencies come in
// two forms — Go import paths, and names already converted by OpenAPIModelName —
// and converting an already-converted name reverses it twice.
func friendly(name string) string {
	if strings.Contains(name, "/") {
		return util.ToRESTFriendlyName(name)
	}
	return name
}

func schemaRef(goName string) spec.Ref {
	return spec.MustCreateRef(componentPrefix + friendly(goName))
}

// envelopeSchemas returns the components a route referencing roots needs, since
// each group version's spec is self-contained.
//
// Dependencies are followed rather than listed so a new envelope field cannot
// reference a component nobody publishes — which renders as an empty model with no
// error. The common package is merged in because the envelope reaches types it
// owns, and through them metav1.LabelSelector.
func envelopeSchemas(roots ...string) map[string]spec.Schema {
	defs := searchv0.GetOpenAPIDefinitions(schemaRef)
	for name, def := range commonv0.GetOpenAPIDefinitions(schemaRef) {
		defs[name] = def
	}

	out := map[string]spec.Schema{}
	queue := append([]string{}, roots...)
	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]

		if _, seen := out[friendly(name)]; seen {
			continue
		}
		def, ok := defs[name]
		if !ok {
			continue
		}
		out[friendly(name)] = def.Schema
		queue = append(queue, def.Dependencies...)
	}

	return out
}

// jsonContent describes a JSON body carrying the named Go type.
func jsonContent(goName string) map[string]*spec3.MediaType {
	return map[string]*spec3.MediaType{
		"application/json": {
			MediaTypeProps: spec3.MediaTypeProps{
				Schema: &spec.Schema{
					SchemaProps: spec.SchemaProps{Ref: schemaRef(goName)},
				},
			},
		},
	}
}
