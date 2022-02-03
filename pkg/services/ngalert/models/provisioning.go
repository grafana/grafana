package models

type Provenance string

const (
	ProvenanceNone Provenance = ""
	ProvenanceApi  Provenance = "api"
	ProvenanceFile Provenance = "file"
)

type Provisionable interface {
	ResourceTypeID() string
	ResourceID() string
}
