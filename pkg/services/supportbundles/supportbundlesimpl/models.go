package supportbundlesimpl

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	ActionRead   = "support.bundles:read"
	ActionCreate = "support.bundles:create"
	ActionDelete = "support.bundles:delete"
)

var (
	bundleReaderRole = accesscontrol.RoleDTO{
		Name:        "fixed:support.bundles:reader",
		DisplayName: "Reader",
		Description: "List and download support bundles",
		Group:       "Support bundles",
		Permissions: []accesscontrol.Permission{
			{Action: ActionRead},
		},
	}

	bundleWriterRole = accesscontrol.RoleDTO{
		Name:        "fixed:support.bundles:writer",
		DisplayName: "Writer",
		Description: "Create, delete, list and download support bundles",
		Group:       "Support bundles",
		Permissions: []accesscontrol.Permission{
			{Action: ActionRead},
			{Action: ActionCreate},
			{Action: ActionDelete},
		},
	}
)

// FixedRoleRegistrations returns support-bundle role registrations with grants
// adjusted for the running instance. When serverAdminOnly is true the grants
// are restricted to GrafanaAdmin; otherwise both OrgAdmin and GrafanaAdmin
// receive the roles.
func FixedRoleRegistrations(serverAdminOnly bool) []accesscontrol.RoleRegistration {
	grants := []string{string(org.RoleAdmin), accesscontrol.RoleGrafanaAdmin}
	if serverAdminOnly {
		grants = []string{accesscontrol.RoleGrafanaAdmin}
	}
	return []accesscontrol.RoleRegistration{
		{Role: bundleWriterRole, Grants: grants},
		{Role: bundleReaderRole, Grants: grants},
	}
}

func (s *Service) declareFixedRoles(ac accesscontrol.Service) error {
	return ac.DeclareFixedRoles(FixedRoleRegistrations(s.serverAdminOnly)...)
}
