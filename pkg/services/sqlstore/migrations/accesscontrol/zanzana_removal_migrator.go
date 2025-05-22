package accesscontrol

import (
	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const ZananaRemovalMigrationID = "Zanzana tables removal grafana migrator to openfga migrations"

func AddZananaRemovalMigrator(mg *migrator.Migrator) {
	mg.AddMigration(ZananaRemovalMigrationID, &zanzanaRemovalMigrator{})
}

type zanzanaRemovalMigrator struct {
	sess     *xorm.Session
	migrator *migrator.Migrator
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(zanzanaRemovalMigrator)

func (m *zanzanaRemovalMigrator) SQL(migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *zanzanaRemovalMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	m.sess = sess
	m.migrator = migrator
	return m.migrateZanzana()
}

func (m *zanzanaRemovalMigrator) migrateZanzana() error {
	/*
			DROP TABLE tuple;
		DROP TABLE authorization_model;
		DROP TABLE store;
		DROP TABLE assertion;
		DROP TABLE changelog;
	*/
	sql := `
	DROP TABLE IF EXISTS tuple;
	DROP TABLE IF EXISTS authorization_model;
	DROP TABLE IF EXISTS store;
	DROP TABLE IF EXISTS assertion;
	DROP TABLE IF EXISTS changelog;
	`

	_, err := m.sess.Exec(sql)
	if err != nil {
		return err
	}

	return nil
}
