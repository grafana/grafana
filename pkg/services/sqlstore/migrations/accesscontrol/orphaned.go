package accesscontrol

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	orphanedServiceAccountsPermissions = "delete orphaned service account permissions"
)

func AddOrphanedMigrations(mg *migrator.Migrator) {
	mg.AddMigration(orphanedServiceAccountsPermissions, &orphanedServiceAccountPermissions{})
}

var _ migrator.CodeMigration = new(alertingScopeRemovalMigrator)

type orphanedServiceAccountPermissions struct {
	migrator.MigrationBase
}

func (m *orphanedServiceAccountPermissions) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *orphanedServiceAccountPermissions) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var idents []string

	// find all permissions that are scopes directly to a service account
	err := sess.SQL("SELECT DISTINCT p.identifier FROM permission AS p WHERE p.kind  = 'serviceaccounts' AND NOT p.identifier = '*'").Find(&idents)
	if err != nil {
		return fmt.Errorf("failed to fetch permissinos scoped to service accounts: %w", err)
	}

	ids := make([]int64, 0, len(idents))
	for _, id := range idents {
		id, err := strconv.ParseInt(id, 10, 64)
		if err == nil {
			ids = append(ids, id)
		}
	}

	if len(ids) == 0 {
		return nil
	}

	return batch(len(ids), batchSize, func(start, end int) error {
		return m.exec(sess, mg, ids[start:end])
	})
}

func (m *orphanedServiceAccountPermissions) exec(sess *xorm.Session, mg *migrator.Migrator, ids []int64) error {
	// get all service accounts from batch
	raw := "SELECT u.id FROM " + mg.Dialect.Quote("user") + " AS u WHERE u.is_service_account AND u.id IN(?" + strings.Repeat(",?", len(ids)-1) + ")"
	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	var existingIDs []int64
	err := sess.SQL(raw, args...).Find(&existingIDs)
	if err != nil {
		return fmt.Errorf("failed to fetch existing service accounts: %w", err)
	}

	existing := make(map[int64]struct{}, len(existingIDs))
	for _, id := range existingIDs {
		existing[id] = struct{}{}
	}

	// filter out orphaned permissions
	var orphaned []string
	for _, id := range ids {
		if _, ok := existing[id]; !ok {
			orphaned = append(orphaned, strconv.FormatInt(id, 10))
		}
	}

	if len(orphaned) == 0 {
		return nil
	}

	// delete all orphaned permissions
	rawDelete := "DELETE FROM permission WHERE kind = 'serviceaccounts' AND identifier IN(?" + strings.Repeat(",?", len(orphaned)-1) + ")"
	deleteArgs := make([]any, 0, len(orphaned)+1)
	deleteArgs = append(deleteArgs, rawDelete)
	for _, id := range orphaned {
		deleteArgs = append(deleteArgs, id)
	}

	_, err = sess.Exec(deleteArgs...)
	if err != nil {
		return fmt.Errorf("failed to delete orphaned service accounts: %w", err)
	}

	return nil
}
