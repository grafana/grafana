package models

import "github.com/grafana/alerting/notify"

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
	Integrations []*notify.GrafanaIntegrationConfig
	Provenance   Provenance
}

// Identified describes a class of resources that have a UID. Created to abstract required fields for authorization.
type Identified interface {
	GetUID() string
}

func (r Receiver) GetUID() string {
	return r.UID
}
