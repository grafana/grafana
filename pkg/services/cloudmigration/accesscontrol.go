package cloudmigration

import "github.com/grafana/grafana/pkg/services/accesscontrol"

const (
	ScopeRoot = "migrationassistant"

	ActionMigrate = ScopeRoot + ":migrate"
)

var (
	// MigrationAssistantAccess is used to protect the "Migrate to Grafana Cloud" page.
	MigrationAssistantAccess = accesscontrol.EvalPermission(ActionMigrate)
)

func RegisterAccessControlRoles(service accesscontrol.Service) error {
	migrator := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:" + ScopeRoot + ":migrator",
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

	return service.DeclareFixedRoles(migrator)
}
