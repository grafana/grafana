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

	// [orgID, dataSourceId] -> [UID, Name]
	dsIDMap, err := m.slurpDSIDs()
	if err != nil {
		return err
	}

	// [orgID, dashboardId] -> dashUID
	dashIDMap, err := m.slurpDashUIDs()
	if err != nil {
		return err
	}

	for _, da := range dashAlerts {
		newCond, err := transConditions(*da.ParsedSettings, da.OrgId, dsIDMap)
		if err != nil {
			return err
		}

		da.DashboardUID = dashIDMap[[2]int64{da.OrgId, da.DashboardId}]

		tempFolderUID := os.Getenv("UALERT_FOLDER_UID")
		if tempFolderUID == "" {
			return fmt.Errorf("missing folder UID for alerts")
		}
		type dashboard struct {
			IsFolder bool
		}
		folder := dashboard{}
		exists, err := m.sess.Where("org_id=? AND uid=?", da.OrgId, tempFolderUID).Get(&folder)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("folder with UID %v not found", tempFolderUID)
		}
		if !folder.IsFolder {
			return fmt.Errorf("uid %v is a dashboard not a folder", tempFolderUID)
		}

		rule, err := m.makeAlertRule(*newCond, da, tempFolderUID)
		if err != nil {
			return err
		}

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

	return nil
}
