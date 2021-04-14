package ualert

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

func AddMigration(mg *migrator.Migrator) {
	mg.AddMigration("move dashboard alerts to unified alerting", &migration{})
}

type migration struct {
	migrator.MigrationBase
	sess *xorm.Session
	mg   *migrator.Migrator
}

func (m *migration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *migration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	m.sess = sess
	m.mg = mg

	dashAlerts, err := m.slurpDashAlerts()
	if err != nil {
		return err
	}

	_ = dashAlerts

	return nil
}
