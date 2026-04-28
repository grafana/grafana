package pulse

import (
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// RBAC actions for Pulse.
//
// In v1 Pulse threads always live on a dashboard, so write/delete/admin all
// gate on the parent dashboard's read permission: anyone who can view a
// dashboard can comment on it. This is intentional and matches the
// "discussion is part of the dashboard" UX. Admins can change this in the
// future via custom roles or a config setting.
const (
	ActionRead   = "pulse:read"
	ActionWrite  = "pulse:write"
	ActionDelete = "pulse:delete"
	ActionAdmin  = "pulse:admin"
)

// ScopeAll is the broadest scope a Pulse permission can take. Most write
// checks defer to the parent dashboard's scope rather than to a Pulse scope
// directly.
const ScopeAll = "pulse:*"

// ParentDashboardScope returns the dashboard scope that must be readable for
// a caller to interact with a thread attached to that dashboard.
func ParentDashboardScope(dashboardUID string) string {
	return dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashboardUID)
}
