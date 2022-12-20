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
		DisplayName: "Support bundle reader",
		Description: "List and download support bundles",
		Group:       "Support bundles",
		Permissions: []accesscontrol.Permission{
			{Action: ActionRead},
		},
	}

	bundleWriterRole = accesscontrol.RoleDTO{
		Name:        "fixed:support.bundles:writer",
		DisplayName: "Support bundle writer",
		Description: "Create, delete, list and download support bundles",
		Group:       "Support bundles",
		Permissions: []accesscontrol.Permission{
			{Action: ActionRead},
			{Action: ActionCreate},
			{Action: ActionDelete},
		},
	}
)

func DeclareFixedRoles(ac accesscontrol.Service) error {
	bundleReader := accesscontrol.RoleRegistration{
		Role:   bundleReaderRole,
		Grants: []string{string(org.RoleAdmin)},
	}
	bundleWriter := accesscontrol.RoleRegistration{
		Role:   bundleWriterRole,
		Grants: []string{string(org.RoleAdmin)},
	}

	return ac.DeclareFixedRoles(bundleWriter, bundleReader)
}
