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
