package v0alpha1

import (
	"github.com/grafana/grafana-app-sdk/resource"
)

// schema is unexported to prevent accidental overwrites
var (
	schemaAlertEnrichment = resource.NewSimpleSchema(APIGroup, APIVersion, &AlertEnrichment{}, &AlertEnrichmentList{}, resource.WithKind("AlertEnrichment"),
		resource.WithPlural("alertenrichments"), resource.WithScope(resource.NamespacedScope))
	kindAlertEnrichment = resource.Kind{
		Schema: schemaAlertEnrichment,
		Codecs: map[resource.KindEncoding]resource.Codec{
			resource.KindEncodingJSON: &AlertEnrichmentJSONCodec{},
		},
	}
)

// AlertEnrichmentKind returns a resource.Kind for this Schema with a JSON codec
func AlertEnrichmentKind() resource.Kind {
	return kindAlertEnrichment
}

// AlertEnrichmentSchema returns a resource.SimpleSchema representation of AlertEnrichment
func AlertEnrichmentSchema() *resource.SimpleSchema {
	return schemaAlertEnrichment
}
