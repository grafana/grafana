package ualert

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"uuid"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
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

	mg.AddMigration("cleanup alert_rule_version table", &cleanUpRuleVersionsMigration{})

	mg.AddMigration("populate rule guid in alert rule table", &setRuleGuidMigration{})

	// This is a separate migration step (not folded into setRuleGuidMigration above) so that it
	// still runs - and fixes affected databases - even on instances that already ran "populate
	// rule guid in alert rule table" successfully before this dedup step existed. Each migration
	// step is logged and skipped on its own once it succeeds, so appending this logic to the
	// existing step would mean it never executes on a database that already completed that step,
	// leaving such databases to keep hitting the duplicate-key error on the unique index added
	// below.
	mg.AddMigration("deduplicate empty rule_guid values in alert_rule_version table", &deduplicateRuleVersionGuidsMigration{})

	mg.AddMigration("drop index in alert_rule_version table on rule_org_id, rule_uid and version columns", migrator.NewDropIndexMigration(alertRuleVersion, alertRuleVersionUDX_OrgIdRuleUIDVersion))

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
			u := uuid.NewV4().String()
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
		lastId = new(results[len(results)-1])
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

type deduplicateRuleVersionGuidsMigration struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = (*deduplicateRuleVersionGuidsMigration)(nil)

func (c deduplicateRuleVersionGuidsMigration) SQL(migrator.Dialect) string {
	return codeMigration
}

// Exec assigns a synthetic rule_guid to every alert_rule_version row whose rule_guid is still
// empty after setRuleGuidMigration runs. Some alert_rule_version rows do not correspond to any
// existing alert_rule row any more (e.g. historical versions kept after the rule was deleted, or
// rows left behind by prior buggy migrations/inserts); setRuleGuidMigration's join-based UPDATE
// only sets rule_guid for rows whose rule_uid/rule_org_id still match an alert_rule, so these
// leftover rows keep the column default of an empty string. Multiple such rows frequently share
// the same (empty rule_guid, version) pair, which violates the unique index added later in this
// migration set ("add index in alert_rule_version table on rule_guid and version columns"). This
// fixes that without deleting any historical data.
func (c deduplicateRuleVersionGuidsMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	return c.deduplicateEmptyRuleGuids(sess, mg)
}

// ruleVersionKey identifies a logical alert rule (by org + uid) that one or more
// alert_rule_version rows belong to.
type ruleVersionKey struct {
	RuleOrgID int64  `xorm:"rule_org_id"`
	RuleUID   string `xorm:"rule_uid"`
}

// deduplicateEmptyRuleGuids assigns a GUID to every alert_rule_version row whose rule_guid is
// still empty after being populated from alert_rule. This prevents the later unique index on
// (rule_guid, version) from failing because of rows sharing the empty-string default.
//
// rule_guid is used elsewhere (e.g. to group all versions of a rule, or to delete a trashed
// rule's versions - see GetAlertRuleVersions/DeleteRuleFromTrashByGUID in
// pkg/services/ngalert/store/rules/alert_rule.go) as the stable identifier that ties together
// every version row belonging to the SAME logical rule. So rather than giving every affected
// row its own independent GUID - which would incorrectly split one rule's version history into
// several unrelated "rules" whenever it has more than one leftover version row - this assigns
// one shared, synthetic GUID per distinct (rule_org_id, rule_uid) group. No rows are ever
// deleted; every historical version record is preserved.
func (c deduplicateRuleVersionGuidsMigration) deduplicateEmptyRuleGuids(sess *xorm.Session, mg *migrator.Migrator) error {
	var keys []ruleVersionKey
	if err := sess.Table(`alert_rule_version`).Distinct("rule_org_id", "rule_uid").Where("rule_guid = ''").Find(&keys); err != nil {
		return err
	}

	isMySQL := mg.Dialect.DriverName() == migrator.MySQL

	const batchSize = 500
	for start := 0; start < len(keys); start += batchSize {
		end := min(start+batchSize, len(keys))
		batch := keys[start:end]

		bd := strings.Builder{}
		for idx, k := range batch {
			u := uuid.NewV4().String()
			escapedUID := escapeSQLStringLiteral(k.RuleUID, isMySQL)
			if idx == 0 {
				bd.WriteString(fmt.Sprintf("SELECT %d as rule_org_id, '%s' as rule_uid, '%s' as guid", k.RuleOrgID, escapedUID, u))
				continue
			}
			bd.WriteString(fmt.Sprintf(" UNION ALL SELECT %d, '%s', '%s' ", k.RuleOrgID, escapedUID, u))
		}
		var q string
		if isMySQL {
			q = fmt.Sprintf(`UPDATE alert_rule_version AS arv
			INNER JOIN (%s) AS t ON arv.rule_org_id = t.rule_org_id AND arv.rule_uid = t.rule_uid
			SET arv.rule_guid = t.guid
			WHERE arv.rule_guid = '';`, bd.String())
		} else {
			q = fmt.Sprintf(`UPDATE alert_rule_version SET rule_guid = t.guid
			FROM (%s) AS t
			WHERE alert_rule_version.rule_org_id = t.rule_org_id
			  AND alert_rule_version.rule_uid = t.rule_uid
			  AND alert_rule_version.rule_guid = ''`, bd.String())
		}
		if _, err := sess.Exec(q); err != nil {
			mg.Logger.Error("Failed to deduplicate empty rule_guid values in alert_rule_version table", "error", err)
			return err
		}
	}
	return nil
}

// escapeSQLStringLiteral escapes a value so it can be safely embedded inside a single-quoted
// SQL string literal built via fmt.Sprintf. Doubling the quote character is standard ANSI SQL
// and is correctly understood by SQLite, Postgres, and MySQL alike. MySQL additionally treats
// backslash as an escape character under its default (non-ANSI) sql_mode, so an unescaped
// trailing backslash could otherwise swallow the literal's closing quote and desynchronize the
// rest of the generated statement; that only applies on the MySQL dialect; doubling a backslash
// on SQLite/Postgres would incorrectly change the value being matched, since they do not treat
// backslash specially in string literals.
func escapeSQLStringLiteral(s string, isMySQL bool) string {
	if isMySQL {
		s = strings.ReplaceAll(s, `\`, `\\`)
	}
	return strings.ReplaceAll(s, "'", "''")
}

type cleanUpRuleVersionsMigration struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = (*cleanUpRuleVersionsMigration)(nil)

func (c cleanUpRuleVersionsMigration) SQL(migrator.Dialect) string {
	return codeMigration
}

func getBatchSize() int {
	const defaultBatchSize = 50
	envvar := os.Getenv("ALERT_RULE_VERSION_CLEANUP_MIGRATION_BATCH_SIZE")
	if envvar == "" {
		return defaultBatchSize
	}
	batchSize, err := strconv.Atoi(envvar)
	if err != nil {
		return defaultBatchSize
	}
	return batchSize
}

func (c cleanUpRuleVersionsMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var batchSize = getBatchSize()

	const maxRetention = 100
	toKeep := mg.Cfg.UnifiedAlerting.RuleVersionRecordLimit
	if toKeep <= 0 {
		mg.Logger.Info("Rule version record limit is not set, fallback to 100", "limit", toKeep)
		toKeep = maxRetention
	}

	var rules []alertRule
	err := sess.Table(alertRule{}).Select("uid, version").Where("version > ?", toKeep).Find(&rules)
	if err != nil {
		return err
	}
	mg.Logger.Debug("Got alert rule UIDs with versions greater than retention", "count", len(rules))
	batches := len(rules) / batchSize
	if len(rules)%batchSize != 0 {
		batches++
	}

	mg.Logger.Info("Cleaning up table `alert_rule_version`", "batchSize", batchSize, "batches", batches, "keepVersions", toKeep)

	for i := 0; i < batches; i++ {
		end := min(i*batchSize+batchSize, len(rules))
		bd := strings.Builder{}
		for idx, r := range rules[i*batchSize : end] {
			if idx == 0 {
				bd.WriteString(fmt.Sprintf("SELECT '%s' as uid, %d as version", r.UID, r.Version))
				continue
			}
			bd.WriteString(fmt.Sprintf(" UNION ALL SELECT '%s', %d ", r.UID, r.Version))
		}
		_, err = sess.Exec(fmt.Sprintf(`
			DELETE FROM alert_rule_version
			WHERE EXISTS (
			    SELECT 1
			    FROM (%s) AR
			    WHERE AR.uid = alert_rule_version.rule_uid 
			    AND alert_rule_version.version < AR.version - %d
			)`, bd.String(), toKeep),
		)
		if err != nil {
			return err
		}

		mg.Logger.Debug(fmt.Sprintf("Batch %d of %d processed", i+1, batches))
	}
	return nil
}
