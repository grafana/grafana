package search

import (
	"maps"

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
	return defs
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
