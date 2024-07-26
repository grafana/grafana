package models

import (
	"github.com/grafana/alerting/notify"
)

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

// Receiver is the domain model representation of a receiver / contact point.
type Receiver struct {
	Name         string
	Integrations []*notify.GrafanaIntegrationConfig
	Provenance   Provenance
}
