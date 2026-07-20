package cloudmigration

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ActionMigrate = "migrationassistant:migrate"
)

var (
	// MigrationAssistantAccess is used to protect the "Migrate to Grafana Cloud" page.
	MigrationAssistantAccess = accesscontrol.EvalPermission(ActionMigrate)
)

// FixedRoleRegistrations returns the cloud migration role registrations.
func FixedRoleRegistrations() []accesscontrol.RoleRegistration {
	migrator := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:migrationassistant:migrator",
			DisplayName: "Organization resource migrator",
			Description: "Migrate organization resources.",
			Group:       "Migration Assistant",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionMigrate,
				},
			},
		},
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	return []accesscontrol.RoleRegistration{migrator}
}

func RegisterAccessControlRoles(service accesscontrol.Service) error {
	return service.DeclareFixedRoles(FixedRoleRegistrations()...)
}
