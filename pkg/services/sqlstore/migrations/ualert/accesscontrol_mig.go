package ualert

import (
	"fmt"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	AddReceiverReaderToRulesWritersName = "Add role fixed:alerting.receivers:reader to all 'fixed:alerting.rules:writer'"
)

// AddReceiverReaderToRulesWriters is a migration that adds role `fixed:alerting.receivers:reader` to all users\teams that have role `fixed:alerting.rules:writer`.
// Originally, the `fixed:alerting.rules:reader` and `fixed:alerting.rules:writer` had permission to list receivers (with no settings) but with migration to K8s API,
// and introduction of fine-grained access control for receivers, the list permission was sunset. This migration makes sure that after upgrade,
// users will keep access to receivers on rule edit page.
// The decision to let only writers have ability to read receivers is based on the fact that for readers this is not important
// because the receiver name is part of the rule definition, and there is no need to fetch it from API. In contrast, writers
// should be able to select receiver from the list of available receivers.
func AddReceiverReaderToRulesWriters(mg *migrator.Migrator) {
	mg.AddMigration(AddReceiverReaderToRulesWritersName, &addReceiverReaderToRulesWritersMigrator{})
}

var _ migrator.CodeMigration = (*addReceiverReaderToRulesWritersMigrator)(nil)

type addReceiverReaderToRulesWritersMigrator struct {
	migrator.MigrationBase
}

func (p addReceiverReaderToRulesWritersMigrator) SQL(migrator.Dialect) string {
	return codeMigration
}

func (p addReceiverReaderToRulesWritersMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	userResult, err := sess.Exec(`
INSERT INTO user_role (org_id, user_id, role_id, created)
SELECT ur.org_id, ur.user_id, rr.id, ?
FROM role as rr
         JOIN
     (SELECT user_id, org_id
      FROM user_role as u
      WHERE EXISTS (SELECT 1
                    FROM role as ra
                    WHERE u.role_id = ra.id
                      AND ra.org_id = 0
                      AND ra.name = 'fixed:alerting.rules:writer')) as ur
WHERE rr.name = 'fixed:alerting.receivers:reader'
  AND rr.org_id = 0
  AND NOT EXISTS(SELECT 1
                 FROM user_role AS uu
                 WHERE uu.org_id = ur.org_id
                   AND uu.user_id == ur.user_id
                   AND uu.role_id == rr.id)
`, time.Now())
	if err != nil {
		return fmt.Errorf("failed to grant users with role 'fixed:alerting.rules:writer' role 'fixed:alerting.receivers:reader': %w", err)
	}

	usersRows, err := userResult.RowsAffected()
	if err != nil {
		migrator.Logger.Warn("Failed to get rows affected after inserting into user_role", "err", err)
	} else {
		migrator.Logger.Info("Assigned role 'fixed:alerting.receivers:reader' to users who have 'fixed:alerting.rules:writer'", "users", usersRows)
	}

	teamResult, err := sess.Exec(`
INSERT INTO team_role (org_id, team_id, role_id, created)
SELECT tr.org_id, tr.team_id, rr.id, ?
FROM role as rr
         JOIN
     (SELECT team_id, org_id
      FROM team_role as t
      WHERE EXISTS (SELECT 1
                    FROM role as ra
                    WHERE t.role_id = ra.id
                      AND ra.org_id = 0
                      AND ra.name = 'fixed:alerting.rules:writer')) as tr
WHERE rr.name = 'fixed:alerting.receivers:reader'
  AND rr.org_id = 0
  AND NOT EXISTS(SELECT 1
                 FROM team_role AS tt
                 WHERE tt.org_id = tr.org_id
                   AND tt.team_id == tr.team_id
                   AND tt.role_id == rr.id)
`, time.Now())
	if err != nil {
		return fmt.Errorf("failed to grant teams with role 'fixed:alerting.rules:writer' role 'fixed:alerting.receivers:reader': %w", err)
	}

	teamRows, err := teamResult.RowsAffected()
	if err != nil {
		migrator.Logger.Warn("Failed to get rows affected after inserting into team_role", "err", err)
	} else {
		migrator.Logger.Info("Assigned role 'fixed:alerting.receivers:reader' to teams who have 'fixed:alerting.receivers:reader'", "teams", teamRows)
	}

	return nil
}
