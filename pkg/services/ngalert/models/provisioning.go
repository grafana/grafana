package models

type Provenance string

const (
	// ProvenanceNone reflects the provenance when no provenance is stored
	// for the requested object in the database.
	ProvenanceNone Provenance = ""
	ProvenanceAPI  Provenance = "api"
	ProvenanceFile Provenance = "file"
)

// Provisionable represents a resource that can be created through a provisioning mechanism, such as Terraform or config file.
type Provisionable interface {
	ResourceType() string
	ResourceID() string
	ResourceOrgID() int64
}

// ProvisionableInOrg represents a resource that can be provisioned, given external org-related information.
type ProvisionableInOrg interface {
	ResourceType() string
	ResourceID() string
}
