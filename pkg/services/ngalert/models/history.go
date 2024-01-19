package models

import (
	"time"

	"github.com/grafana/grafana/pkg/services/auth/identity"
)

// HistoryQuery represents a query for alert state history.
type HistoryQuery struct {
	RuleUID      string
	OrgID        int64
	DashboardUID string
	PanelID      int64
	Labels       map[string]string
	From         time.Time
	To           time.Time
	Limit        int
	SignedInUser identity.Requester
}
