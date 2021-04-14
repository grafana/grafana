package ualert

import (
	"os"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

func AddMigration(mg *migrator.Migrator) {
	if os.Getenv("UALERT_MIG") == "iDidBackup" {
		mg.AddMigration("move dashboard alerts to unified alerting", &migration{})
	}
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

	dsIDMap, err := m.slurpDSIDs()
	if err != nil {
		return err
	}

	for _, da := range dashAlerts {
		newCond, err := transConditions(*da.ParsedSettings, da.OrgId, dsIDMap)
		if err != nil {
			return err
		}

		_ = newCond
	}

	return nil
}
