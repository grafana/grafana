package search

import (
	"maps"
	"slices"

	openapi "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	commonv0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// Go names, because that is how the generated definitions are keyed.
const (
	envelopePkg               = "github.com/grafana/grafana/pkg/apis/search/v0alpha1."
	searchQueryGoName         = envelopePkg + searchv0.KindSearchQuery
	globalSearchQueryGoName   = envelopePkg + "GlobalSearchQuery"
	searchResultsGoName       = envelopePkg + searchv0.KindSearchResults
	globalSearchResultsGoName = envelopePkg + searchv0.KindGlobalSearchResults
	trashQueryGoName          = envelopePkg + searchv0.KindTrashQuery
	trashResultsGoName        = envelopePkg + searchv0.KindTrashResults
	hybridSearchQueryGoName   = envelopePkg + searchv0.KindHybridSearchQuery
	hybridSearchResultsGoName = envelopePkg + searchv0.KindHybridSearchResults
)

// envelopeSchemas returns the components a route referencing roots needs, since
// each group version's spec is self-contained.
func envelopeSchemas(roots ...string) map[string]spec.Schema {
	return builder.RouteSchemas(envelopeDefinitions, roots...)
}

// The common package is merged in because the envelope reaches types it owns, and
// through them metav1.LabelSelector.
func envelopeDefinitions(ref openapi.ReferenceCallback) map[string]openapi.OpenAPIDefinition {
	defs := searchv0.GetOpenAPIDefinitions(ref)
	maps.Copy(defs, commonv0.GetOpenAPIDefinitions(ref))
	for name, def := range defs {
		schema := def.Schema
		clearInvalidEnumDefaults(&schema)
		def.Schema = schema
		defs[name] = def
	}
	return defs
}

// clearInvalidEnumDefaults removes a default the schema itself disallows.
// openapi-gen gives a required field its zero value as the default, so an enum
// defaults to "" — outside it, and a value the API rejects with a 422. Callers
// read these schemas from the published spec, so they must not be offered it.
func clearInvalidEnumDefaults(schema *spec.Schema) {
	if schema == nil {
		return
	}
	if len(schema.Enum) > 0 && schema.Default != nil && !slices.Contains(schema.Enum, schema.Default) {
		schema.Default = nil
	}
	for name, property := range schema.Properties {
		clearInvalidEnumDefaults(&property)
		schema.Properties[name] = property
	}
	if schema.Items != nil {
		clearInvalidEnumDefaults(schema.Items.Schema)
	}
}

// jsonContent describes a JSON body carrying the named Go type.
func jsonContent(goName string, example any) map[string]*spec3.MediaType {
	return map[string]*spec3.MediaType{
		"application/json": {
			MediaTypeProps: spec3.MediaTypeProps{
				Schema: &spec.Schema{
					SchemaProps: spec.SchemaProps{Ref: builder.RouteSchemaRef(goName)},
				},
				Example: example,
			},
		},
	}
}
