package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	AlertingScopeRemovalMigrationID           = "removing scope from alert.instances:read action migration"
	AnnotationsAllScopeReplacementMigrationID = "replacing annotations:* scope with annotations:type:organization scope"
)

func AddAlertingScopeRemovalMigration(mg *migrator.Migrator) {
	mg.AddMigration(AlertingScopeRemovalMigrationID, &alertingScopeRemovalMigrator{})
}

var _ migrator.CodeMigration = new(alertingScopeRemovalMigrator)

type alertingScopeRemovalMigrator struct {
	permissionMigrator
}

func (p *alertingScopeRemovalMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (p *alertingScopeRemovalMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	p.sess = sess
	p.dialect = migrator.Dialect
	_, err := p.sess.Exec("UPDATE permission SET `scope` = '', `kind` = '', `attribute` = '', `identifier` = '' WHERE action = ?", accesscontrol.ActionAlertingInstanceRead)
	return err
}

func AddAnnotationsAllScopeReplacementMigration(mg *migrator.Migrator) {
	mg.AddMigration(AnnotationsAllScopeReplacementMigrationID, &annotationsAllScopeReplacementMigrator{})
}

var _ migrator.CodeMigration = new(annotationsAllScopeReplacementMigrator)

type annotationsAllScopeReplacementMigrator struct {
	permissionMigrator
}

func (p *annotationsAllScopeReplacementMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (p *annotationsAllScopeReplacementMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	p.sess = sess
	p.dialect = migrator.Dialect

	// Remove annotations:* rows where annotations:type:organization already exists
	// for the same (action, role_id), to prevent a UNIQUE constraint violation on the UPDATE below.
	// The derived table wrapper avoids MySQL error 1093 ("can't specify target table in FROM clause").
	if _, err := p.sess.Exec(`DELETE FROM permission WHERE scope = 'annotations:*' AND action IN (?, ?, ?, ?) AND EXISTS (
		SELECT 1 FROM (SELECT action, role_id FROM permission WHERE scope = 'annotations:type:organization') AS p2
		WHERE p2.action = permission.action AND p2.role_id = permission.role_id
	)`,
		accesscontrol.ActionAnnotationsRead,
		accesscontrol.ActionAnnotationsWrite,
		accesscontrol.ActionAnnotationsCreate,
		accesscontrol.ActionAnnotationsDelete,
	); err != nil {
		return fmt.Errorf("delete annotations:* permissions: %w", err)
	}

	_, err := p.sess.Exec("UPDATE permission SET `scope` = 'annotations:type:organization' WHERE action IN (?, ?, ?, ?) AND scope = 'annotations:*'",
		accesscontrol.ActionAnnotationsRead,
		accesscontrol.ActionAnnotationsWrite,
		accesscontrol.ActionAnnotationsCreate,
		accesscontrol.ActionAnnotationsDelete,
	)
	if err != nil {
		return fmt.Errorf("update annotations:* permissions: %w", err)
	}

	return err
}
