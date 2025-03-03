package ualert

import (
	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

// AddAlertRuleGuidMigration sets up migrations for adding and managing GUID columns in alert_rule and alert_rule_version tables.
func AddAlertRuleGuidMigration(mg *migrator.Migrator) {
	alertRuleVersion := migrator.Table{Name: "alert_rule_version"}
	alertRule := migrator.Table{Name: "alert_rule"}
	mg.AddMigration("add guid column to alert_rule table", migrator.NewAddColumnMigration(alertRule, &migrator.Column{
		Name:     "guid",
		Type:     migrator.DB_Varchar,
		Length:   36,
		Nullable: false,
		Default:  "''",
	}))
	mg.AddMigration("add rule_guid column to alert_rule_version table", migrator.NewAddColumnMigration(alertRuleVersion, &migrator.Column{
		Name:     "rule_guid",
		Type:     migrator.DB_Varchar,
		Length:   36,
		Nullable: false,
		Default:  "''",
	}))
	mg.AddMigration("drop index in alert_rule_version table on rule_org_id, rule_uid and version columns", migrator.NewDropIndexMigration(alertRuleVersion, alertRuleVersionUDX_OrgIdRuleUIDVersion))

	mg.AddMigration("populate rule guid in alert rule table", &setRuleGuidMigration{})

	mg.AddMigration("add index in alert_rule_version table on rule_org_id, rule_uid, rule_guid and version columns",
		migrator.NewAddIndexMigration(alertRuleVersion,
			&migrator.Index{Cols: []string{"rule_org_id", "rule_uid", "rule_guid", "version"}, Type: migrator.UniqueIndex},
		),
	)

	mg.AddMigration("add index in alert_rule_version table on rule_guid and version columns",
		migrator.NewAddIndexMigration(alertRuleVersion,
			&migrator.Index{Cols: []string{"rule_guid", "version"}, Type: migrator.UniqueIndex},
		),
	)

	mg.AddMigration("add index in alert_rule table on guid columns",
		migrator.NewAddIndexMigration(alertRule,
			&migrator.Index{Cols: []string{"guid"}, Type: migrator.UniqueIndex},
		))
}

type setRuleGuidMigration struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = (*setRuleGuidMigration)(nil)

func (c setRuleGuidMigration) SQL(migrator.Dialect) string {
	return codeMigration
}

func (c setRuleGuidMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var results []string
	if err := sess.SQL("SELECT uid FROM alert_rule").Find(&results); err != nil {
		return err
	}
	if len(results) == 0 {
		mg.Logger.Debug("no rules found")
		return nil
	}
	for _, uid := range results {
		u := uuid.NewString()
		_, err := sess.Exec("UPDATE alert_rule_version SET rule_guid = ? WHERE rule_uid = ?", u, uid)
		if err != nil {
			mg.Logger.Error("Failed to update alert_rule_version table", "error", err)
			return err
		}
		_, err = sess.Exec("UPDATE alert_rule SET guid = ? WHERE uid = ?", u, uid)
		if err != nil {
			mg.Logger.Error("Failed to update alert_rule table", "error", err)
			return err
		}
	}
	return nil
}
