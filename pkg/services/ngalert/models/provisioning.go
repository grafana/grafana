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

func (ar *AlertRule) GetResourceTypeIdentifier() string {
	return "alertRule"
}

func (ar *AlertRule) GetResourceUniqueIdentifier() string {
	return ar.UID
}
