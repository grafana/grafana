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

// FixedRoleRegistrations returns the support bundle role registrations.
func FixedRoleRegistrations() []accesscontrol.RoleRegistration {
	grants := []string{string(org.RoleAdmin), accesscontrol.RoleGrafanaAdmin}
	return []accesscontrol.RoleRegistration{
		{Role: bundleWriterRole, Grants: grants},
		{Role: bundleReaderRole, Grants: grants},
	}
}

func (s *Service) declareFixedRoles(ac accesscontrol.Service) error {
	regs := FixedRoleRegistrations()

	if s.serverAdminOnly {
		for i := range regs {
			regs[i].Grants = []string{accesscontrol.RoleGrafanaAdmin}
		}
	}

	return ac.DeclareFixedRoles(regs...)
}
