package pulse

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

// RBAC actions for Pulse.
//
// Pulse threads always live on a dashboard in v1, so each handler also
// asserts dashboards:read on the parent dashboard before consulting
// these actions. The actions themselves gate Pulse-specific behaviour
// independently of dashboard write/edit permissions: a viewer can leave
// a comment without needing to edit the dashboard.
//
// These are scopeless org-level gates: per-thread / per-dashboard
// authorization is enforced by the dashboard guardian and service-layer
// ownership checks (e.g. authors may always delete their own pulses).
// Keeping them scopeless avoids registering a "pulse" kind in the
// permission registry and matches how the API middleware evaluates
// them via ac.EvalPermission(action).
const (
	ActionRead   = "pulse:read"
	ActionWrite  = "pulse:write"
	ActionDelete = "pulse:delete"
	ActionAdmin  = "pulse:admin"
)

var (
	// pulseReaderRole is granted to every org role: anyone who can sign
	// in to Grafana can read pulses on dashboards they have access to.
	// The dashboard read check still gates which dashboards they see.
	pulseReaderRole = accesscontrol.RoleDTO{
		Name:        "fixed:pulse:reader",
		DisplayName: "Pulse reader",
		Description: "Read pulse threads attached to dashboards.",
		Group:       "Pulse",
		Permissions: []accesscontrol.Permission{
			{Action: ActionRead},
		},
	}

	// pulseWriterRole is granted to every org role so any authenticated
	// user that can read a dashboard can comment on it. Authors can
	// always edit/delete their own pulses; service-layer checks enforce
	// that part — the action itself just gates "may use the write API".
	pulseWriterRole = accesscontrol.RoleDTO{
		Name:        "fixed:pulse:writer",
		DisplayName: "Pulse writer",
		Description: "Read and write pulse threads on dashboards.",
		Group:       "Pulse",
		Permissions: []accesscontrol.Permission{
			{Action: ActionRead},
			{Action: ActionWrite},
			{Action: ActionDelete},
		},
	}

	// pulseAdminRole adds privileged actions: closing / reopening
	// threads and deleting other users' pulses. Granted to the org
	// Admin role only so the moderation surface is small.
	pulseAdminRole = accesscontrol.RoleDTO{
		Name:        "fixed:pulse:admin",
		DisplayName: "Pulse admin",
		Description: "Manage pulse threads — close, reopen, and delete on behalf of others.",
		Group:       "Pulse",
		Permissions: []accesscontrol.Permission{
			{Action: ActionRead},
			{Action: ActionWrite},
			{Action: ActionDelete},
			{Action: ActionAdmin},
		},
	}
)

// RegisterAccessControlRoles declares the fixed RBAC roles for Pulse and
// grants them to the org roles that should own them by default. We grant
// reader and writer to every org role so the comment surface is open by
// default; admin actions are restricted to the org Admin role plus the
// Grafana server admin.
func RegisterAccessControlRoles(service accesscontrol.Service) error {
	allOrgRoles := []string{
		string(org.RoleViewer),
		string(org.RoleEditor),
		string(org.RoleAdmin),
		accesscontrol.RoleGrafanaAdmin,
	}
	adminOnly := []string{
		string(org.RoleAdmin),
		accesscontrol.RoleGrafanaAdmin,
	}

	return service.DeclareFixedRoles(
		accesscontrol.RoleRegistration{Role: pulseReaderRole, Grants: allOrgRoles},
		accesscontrol.RoleRegistration{Role: pulseWriterRole, Grants: allOrgRoles},
		accesscontrol.RoleRegistration{Role: pulseAdminRole, Grants: adminOnly},
	)
}
