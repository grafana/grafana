package ualert

import (
	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	AlertingAddReceiverActionScopes = "Add scope to alert.notifications.receivers:read and alert.notifications.receivers.secrets:read"
)

// AddReceiverActionScopesMigration is a migration that will add scopes to alert.notifications.receivers:read and
// alert.notifications.receivers.secrets:read actions.
// Originally, they were created without any scope, but treated as if all actions were globally scoped.
// With the introduction of receiver FGAC, we need to scope these actions to UID so any existing roles should be updated
// to explicitly have the global scope.
func AddReceiverActionScopesMigration(mg *migrator.Migrator) {
	mg.AddMigration(AlertingAddReceiverActionScopes, &addReceiverActionScopesMigrator{})
}

var _ migrator.CodeMigration = (*addReceiverActionScopesMigrator)(nil)

type addReceiverActionScopesMigrator struct {
	migrator.MigrationBase
}

func (p addReceiverActionScopesMigrator) SQL(migrator.Dialect) string {
	return codeMigration
}

func (p addReceiverActionScopesMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	// Vendored.
	actionAlertingReceiversRead := "alert.notifications.receivers:read"
	actionAlertingReceiversReadSecrets := "alert.notifications.receivers.secrets:read"

	_, err := sess.Exec("UPDATE permission SET `scope` = 'receivers:*', `kind` = 'receivers', `attribute` = '*', `identifier` = '*' WHERE action = ?", actionAlertingReceiversRead)
	if err != nil {
		migrator.Logger.Error("Failed to update permissions for action", "action", actionAlertingReceiversRead, "error", err)
		return err
	}

	_, err = sess.Exec("UPDATE permission SET `scope` = 'receivers:*', `kind` = 'receivers', `attribute` = '*', `identifier` = '*' WHERE action = ?", actionAlertingReceiversReadSecrets)
	if err != nil {
		migrator.Logger.Error("Failed to update permissions for action", "action", actionAlertingReceiversReadSecrets, "error", err)
		return err
	}
	return nil
}
