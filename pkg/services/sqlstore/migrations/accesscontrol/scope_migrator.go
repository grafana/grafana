package accesscontrol

import (
	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	AlertingScopeRemovalMigrationID = "removing scope from alert.instances:read action migration"
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
