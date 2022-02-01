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

func (alertRule *AlertRule) GetResourceTypeIdentifier() string {
	return "alertRule"
}

func (alertRule *AlertRule) GetResourceUniqueIdentifier() string {
	return alertRule.UID
}
