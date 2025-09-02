package v0alpha1

import (
	"encoding/json"
	"io"

	"github.com/grafana/grafana-app-sdk/resource"
)

// AlertEnrichmentJSONCodec is a JSON codec for AlertEnrichment resources
type AlertEnrichmentJSONCodec struct{}

// Read reads JSON-encoded bytes from `reader` and unmarshals them into `into`
func (*AlertEnrichmentJSONCodec) Read(reader io.Reader, into resource.Object) error {
	return json.NewDecoder(reader).Decode(into)
}

// Write writes JSON-encoded bytes into `writer` marshaled from `from`
func (*AlertEnrichmentJSONCodec) Write(writer io.Writer, from resource.Object) error {
	return json.NewEncoder(writer).Encode(from)
}

// Interface compliance checks
var _ resource.Codec = &AlertEnrichmentJSONCodec{}
