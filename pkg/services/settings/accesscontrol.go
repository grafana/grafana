package settings

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var settingsWriterRole = accesscontrol.RoleDTO{
	Name:        "fixed:settings:writer",
	DisplayName: "Setting writer",
	Description: "Read and update Grafana instance settings.",
	Group:       "Settings",
	Permissions: accesscontrol.ConcatPermissions(
		accesscontrol.SettingsReaderRole.Permissions,
		[]accesscontrol.Permission{
			{
				Action: accesscontrol.ActionSettingsWrite,
				Scope:  accesscontrol.ScopeSettingsAll,
			},
		}),
}

func DeclareFixedRoles(service accesscontrol.Service) error {
	settingsWriter := accesscontrol.RoleRegistration{
		Role:   settingsWriterRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}
	return service.DeclareFixedRoles(settingsWriter)
}
