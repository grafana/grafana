package models

type Provenance string

const (
	ProvenanceNone Provenance = ""
	ProvenanceApi  Provenance = "api"
	ProvenanceFile Provenance = "file"
)

type Provisionable interface {
	GetResourceTypeIdentifier() string
	GetResourceUniqueIdentifier() string
}
