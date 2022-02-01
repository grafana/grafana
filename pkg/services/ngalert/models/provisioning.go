package models

type Provenance string

const (
	ProvenanceNone Provenance = ""
	ProvenanceApi  Provenance = "api"
	ProvenanceFile Provenance = "file"
)

type ProvisionedObject interface {
	GetResourceTypeIdentifier() string
	GetResourceUniqueIdentifier() string
}
