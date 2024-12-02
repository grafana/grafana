package models

type Provenance string

const (
	// ProvenanceNone reflects the provenance when no provenance is stored
	// for the requested object in the database.
	ProvenanceNone Provenance = ""
	ProvenanceAPI  Provenance = "api"
	ProvenanceFile Provenance = "file"
	// ProvenancePrometheus reflects the provenance when the object is
	// converted from a Prometheus-compatible format or source.
	ProvenancePrometheus Provenance = "prometheus"
)

var (
	KnownProvenances = []Provenance{ProvenanceNone, ProvenanceAPI, ProvenanceFile, ProvenancePrometheus}
)

// Provisionable represents a resource that can be created through a provisioning mechanism, such as Terraform or config file.
type Provisionable interface {
	ResourceType() string
	ResourceID() string
}
