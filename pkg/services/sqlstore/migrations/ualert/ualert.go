package ualert

import (
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

func AddMigration(mg *migrator.Migrator) {
	if os.Getenv("UALERT_MIG") == "iDidBackup" {
		// TODO: unified alerting DB needs to be extacted into ../migrations.go
		// so it runs and creates the tables before this migration runs.
		mg.AddMigration("move dashboard alerts to unified alerting", &migration{})
	}
}

type migration struct {
	migrator.MigrationBase
	// session and mg are attached for convenience.
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

		rule, err := m.makeAlertRule(*newCond, da)
		if err != nil {
			return err
		}
		_ = rule

		_, err = m.sess.Insert(rule)
		if err != nil {
			// TODO better error handling, if constraint
			rule.Title += fmt.Sprintf(" %v", rule.Uid)
			rule.RuleGroup += fmt.Sprintf(" %v", rule.Uid)

			_, err = m.sess.Insert(rule)
			if err != nil {
				return err
			}
		}
	}

	// For assume a dev created a "Unified Alerts Migration folder"

	return nil
}
