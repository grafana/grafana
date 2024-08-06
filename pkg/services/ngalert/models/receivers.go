package models

// GetReceiverQuery represents a query for a single receiver.
type GetReceiverQuery struct {
	OrgID   int64
	Name    string
	Decrypt bool
}

// GetReceiversQuery represents a query for receiver groups.
type GetReceiversQuery struct {
	OrgID   int64
	Names   []string
	Limit   int
	Offset  int
	Decrypt bool
}

// ListReceiversQuery represents a query for listing receiver groups.
type ListReceiversQuery struct {
	OrgID  int64
	Names  []string
	Limit  int
	Offset int
}

// Receiver is the domain model representation of a receiver / contact point.
type Receiver struct {
	UID          string
	Name         string
	Integrations []*Integration
	Provenance   Provenance
}

// Integration is the domain model representation of an integration.
type Integration struct {
	UID                   string
	Name                  string
	Type                  string
	DisableResolveMessage bool
	// Settings can contain both secure and non-secure settings. Secure settings may be encrypted or not.
	Settings map[string]any
	// SecureFields is a map of fields in Settings that are secured. When updating an integration, SecureFields
	// is used to identify which secure fields should be copied from the existing integration.
	SecureFields map[string]bool
}

// Identified describes a class of resources that have a UID. Created to abstract required fields for authorization.
type Identified interface {
	GetUID() string
}

func (r Receiver) GetUID() string {
	return r.UID
}
