package models

import (
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// HistoryQuery represents a query for alert state history.
type HistoryQuery struct {
	RuleUID      string
	OrgID        int64
	DashboardUID string
	PanelID      int64
	Labels       map[string]string
	Previous     string
	Current      string
	From         time.Time
	To           time.Time
	Limit        int
	SignedInUser identity.Requester
}
