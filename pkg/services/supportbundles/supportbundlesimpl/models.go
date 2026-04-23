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
// When serverAdminOnly is true, grants are restricted to GrafanaAdmin only.
func FixedRoleRegistrations(serverAdminOnly bool) []accesscontrol.RoleRegistration {
	grants := []string{string(org.RoleAdmin), accesscontrol.RoleGrafanaAdmin}
	if serverAdminOnly {
		grants = []string{accesscontrol.RoleGrafanaAdmin}
	}

	bundleReader := accesscontrol.RoleRegistration{
		Role:   bundleReaderRole,
		Grants: grants,
	}
	bundleWriter := accesscontrol.RoleRegistration{
		Role:   bundleWriterRole,
		Grants: grants,
	}

	return []accesscontrol.RoleRegistration{bundleWriter, bundleReader}
}

func (s *Service) declareFixedRoles(ac accesscontrol.Service) error {
	return ac.DeclareFixedRoles(FixedRoleRegistrations(s.serverAdminOnly)...)
}
