package coordination

import (
	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

// RBAC actions for the coordination kinds. They enable fine-grained access beyond
// the Grafana-admin / service-identity fast path: a custom role can grant read or
// write on leases and cluster leases to specific users, teams, or service accounts.
const (
	ActionLeasesRead         = "coordination.leases:read"
	ActionLeasesWrite        = "coordination.leases:write"
	ActionClusterLeasesRead  = "coordination.clusterleases:read"
	ActionClusterLeasesWrite = "coordination.clusterleases:write"
)

// FixedRoleRegistrations returns the coordination reader/writer fixed roles. Both are
// granted to org Admins by default; the actions can additionally be attached to
// custom roles for finer-grained assignment.
func FixedRoleRegistrations() []accesscontrol.RoleRegistration {
	reader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "coordination.leases:reader",
			DisplayName: "Coordination leases reader",
			Description: "Read and list coordination Leases and ClusterLeases.",
			Group:       "Coordination",
			Version:     1,
			Permissions: []accesscontrol.Permission{
				{Action: ActionLeasesRead},
				{Action: ActionClusterLeasesRead},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	writer := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        accesscontrol.FixedRolePrefix + "coordination.leases:writer",
			DisplayName: "Coordination leases writer",
			Description: "Create, update, and delete coordination Leases and ClusterLeases.",
			Group:       "Coordination",
			Version:     1,
			Permissions: accesscontrol.ConcatPermissions(reader.Role.Permissions, []accesscontrol.Permission{
				{Action: ActionLeasesWrite},
				{Action: ActionClusterLeasesWrite},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return []accesscontrol.RoleRegistration{reader, writer}
}

// DeclareFixedRoles registers the coordination fixed roles with access control.
func DeclareFixedRoles(service accesscontrol.Service) error {
	return service.DeclareFixedRoles(FixedRoleRegistrations()...)
}

// actionForVerb maps a resource (plural) and a Kubernetes verb to the RBAC action
// that authorizes it, or "" if the verb is unsupported.
func actionForVerb(resource, verb string) string {
	var read, write string
	switch resource {
	case coordinationv0alpha1.LeaseKind().Plural():
		read, write = ActionLeasesRead, ActionLeasesWrite
	case coordinationv0alpha1.ClusterLeaseKind().Plural():
		read, write = ActionClusterLeasesRead, ActionClusterLeasesWrite
	default:
		return ""
	}
	switch verb {
	case "get", "list", "watch":
		return read
	case "create", "update", "patch", "delete", "deletecollection":
		return write
	}
	return ""
}
