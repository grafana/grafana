package ualert

import (
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
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
	var lastId *int64
	for {
		var results []int64
		qq := sess.Table(`alert_rule`).Select("id").OrderBy("id").Limit(500)
		if lastId != nil {
			qq = qq.Where("id > ?", lastId)
		}
		if err := qq.Find(&results); err != nil {
			return err
		}
		if len(results) == 0 {
			break
		}
		bd := strings.Builder{}
		for idx, id := range results {
			u := uuid.NewString()
			if idx == 0 {
				bd.WriteString(fmt.Sprintf("SELECT %d as id, '%s' as guid", id, u))
				continue
			}
			bd.WriteString(fmt.Sprintf(" UNION ALL SELECT %d, '%s' ", id, u))
		}
		var q string
		if mg.Dialect.DriverName() == migrator.MySQL {
			q = fmt.Sprintf(`UPDATE alert_rule AS ar
			INNER JOIN (%s) AS t ON ar.id = t.id
			SET ar.guid = t.guid;`, bd.String())
		} else {
			q = fmt.Sprintf(`UPDATE alert_rule SET guid = t.guid FROM (%s) AS t WHERE alert_rule.id = t.id`, bd.String())
		}
		_, err := sess.Exec(q)
		if err != nil {
			mg.Logger.Error("Failed to update alert_rule table", "error", err)
			return err
		}
		lastId = util.Pointer(results[len(results)-1])
	}

	q := `UPDATE alert_rule_version
		SET rule_guid = alert_rule.guid
		FROM alert_rule
		WHERE alert_rule.uid = alert_rule_version.rule_uid 
		  AND alert_rule.org_id = alert_rule_version.rule_org_id;`

	if mg.Dialect.DriverName() == migrator.MySQL {
		q = `UPDATE alert_rule_version AS arv
			INNER JOIN alert_rule AS ar ON arv.rule_uid = ar.uid AND arv.rule_org_id = ar.org_id
			SET arv.rule_guid = ar.guid;`
	}
	_, err := sess.Exec(q)
	if err != nil {
		mg.Logger.Error("Failed to update alert_rule_version table with GUIDs from alert_rule table", "error", err)
		return err
	}
	return nil
}
