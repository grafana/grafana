package migrator

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

var (
	batchSize = 1000
)

const (
	maxLen = 40
)

func MigrateScopeSplit(db db.DB, log log.Logger) error {
	t := time.Now()
	ctx := context.Background()
	cnt := 0

	// Search for the permissions to update
	var permissions []ac.Permission
	if errFind := db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.SQL("SELECT * FROM permission WHERE NOT scope = '' AND identifier = ''").Find(&permissions)
	}); errFind != nil {
		log.Error("Could not search for permissions to update", "migration", "scopeSplit", "error", errFind)
		return errFind
	}

	if len(permissions) == 0 {
		log.Debug("No permission require a scope split", "migration", "scopeSplit")
		return nil
	}

	errBatchUpdate := batch(len(permissions), batchSize, func(start, end int) error {
		n := end - start

		// IDs to remove
		delQuery := "DELETE FROM permission WHERE id IN ("
		delArgs := make([]any, 0, n)

		// Query to insert the updated permissions
		insertQuery := "INSERT INTO permission (id, role_id, action, scope, kind, attribute, identifier, created, updated) VALUES "
		insertArgs := make([]any, 0, 9*n)

		// Prepare batch of updated permissions
		for i := start; i < end; i++ {
			kind, attribute, identifier := permissions[i].SplitScope()

			// Trim to max length to avoid bootloop.
			// too long scopes will be truncated and the permission will become invalid.
			kind = trimToMaxLen(kind, maxLen)
			attribute = trimToMaxLen(attribute, maxLen)
			identifier = trimToMaxLen(identifier, maxLen)

			delQuery += "?,"
			delArgs = append(delArgs, permissions[i].ID)

			insertQuery += "(?, ?, ?, ?, ?, ?, ?, ?, ?),"
			insertArgs = append(insertArgs, permissions[i].ID, permissions[i].RoleID,
				permissions[i].Action, permissions[i].Scope,
				kind, attribute, identifier,
				permissions[i].Created, t,
			)
		}
		// Remove trailing ','
		insertQuery = insertQuery[:len(insertQuery)-1]

		// Remove trailing ',' and close brackets
		delQuery = delQuery[:len(delQuery)-1] + ")"

		// Batch update the permissions
		if errBatchUpdate := db.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
			if _, errDel := tx.Exec(ctx, delQuery, delArgs...); errDel != nil {
				log.Error("Error deleting permissions", "migration", "scopeSplit", "error", errDel)
				return errDel
			}
			if _, errInsert := tx.Exec(ctx, insertQuery, insertArgs...); errInsert != nil {
				log.Error("Error saving permissions", "migration", "scopeSplit", "error", errInsert)
				return errInsert
			}
			return nil
		}); errBatchUpdate != nil {
			log.Error("Error updating permission batch", "migration", "scopeSplit", "start", start, "end", end)
			return errBatchUpdate
		}

		cnt += end - start
		return nil
	})
	if errBatchUpdate != nil {
		log.Error("Could not migrate permissions", "migration", "scopeSplit", "total", len(permissions), "succeeded", cnt, "left", len(permissions)-cnt, "error", errBatchUpdate)
		return errBatchUpdate
	}

	log.Debug("Migrated permissions", "migration", "scopeSplit", "total", len(permissions), "succeeded", cnt, "in", time.Since(t))
	return nil
}

func batch(count, batchSize int, eachFn func(start, end int) error) error {
	for i := 0; i < count; {
		end := i + batchSize
		if end > count {
			end = count
		}

		if err := eachFn(i, end); err != nil {
			return err
		}

		i = end
	}

	return nil
}

// MigrateRemoveDeprecatedPermissions removes deprecated permissions from the database
func MigrateRemoveDeprecatedPermissions(db db.DB, log log.Logger) error {
	ctx := context.Background()
	ctx, span := tracing.Start(ctx, "migrator.removeDeprecatedPermissions",
		attribute.String("migration.type", "removeDeprecatedPermissions"))
	defer span.End()

	t := time.Now()

	// Define the deprecated permissions to remove
	deprecatedPermissions := []string{
		"apikeys:", // remove in 2026/03
	}
	if len(deprecatedPermissions) == 0 {
		span.SetAttributes(attribute.Bool("migration.skipped", true))
		log.Debug("No deprecated permissions to remove", "migration", "removeDeprecatedPermissions")
		return nil
	}

	span.SetAttributes(attribute.Int("deprecated.patterns.count", len(deprecatedPermissions)))
	log.Info("Starting migration to remove deprecated permissions", "migration", "removeDeprecatedPermissions")

	// Find and remove permissions matching the deprecated patterns
	var totalRemoved int
	for _, permPattern := range deprecatedPermissions {
		patternCtx, patternSpan := tracing.Start(ctx, "migrator.removeDeprecatedPermissions.pattern",
			attribute.String("pattern", permPattern))
		patternSpan.SetAttributes(attribute.String("migration.type", "removeDeprecatedPermissions"))

		var permissions []ac.Permission
		if errFind := db.WithTransactionalDbSession(patternCtx, func(sess *sqlstore.DBSession) error {
			return sess.SQL("SELECT * FROM permission WHERE action LIKE ?", permPattern+"%").Find(&permissions)
		}); errFind != nil {
			log.Error("Could not search for deprecated permissions to remove", "migration", "removeDeprecatedPermissions", "pattern", permPattern, "error", errFind)
			patternSpan.RecordError(errFind)
			patternSpan.End()
			return errFind
		}

		patternSpan.SetAttributes(attribute.Int("permissions.found", len(permissions)))

		if len(permissions) == 0 {
			log.Debug("No permissions found for pattern", "migration", "removeDeprecatedPermissions", "pattern", permPattern)
			patternSpan.End()
			continue
		}

		// Remove permissions in batches
		batchCtx, batchSpan := tracing.Start(patternCtx, "migrator.removeDeprecatedPermissions.batch",
			attribute.String("pattern", permPattern),
			attribute.Int("batch.size", batchSize),
			attribute.Int("permissions.total", len(permissions)))
		batchSpan.SetAttributes(attribute.String("migration.type", "removeDeprecatedPermissions"))

		errBatchRemove := batch(len(permissions), batchSize, func(start, end int) error {
			n := end - start

			// Build delete query for this batch
			delQuery := "DELETE FROM permission WHERE id IN ("
			delArgs := make([]any, 0, n)

			for i := start; i < end; i++ {
				delQuery += "?,"
				delArgs = append(delArgs, permissions[i].ID)
			}

			// Remove trailing ','
			delQuery = delQuery[:len(delQuery)-1] + ")"

			// Execute delete using the same pattern as MigrateScopeSplit
			if errDel := db.GetSqlxSession().WithTransaction(batchCtx, func(tx *session.SessionTx) error {
				_, err := tx.Exec(batchCtx, delQuery, delArgs...)
				return err
			}); errDel != nil {
				log.Error("Error deleting deprecated permissions batch", "migration", "removeDeprecatedPermissions", "pattern", permPattern, "start", start, "end", end, "error", errDel)
				batchSpan.RecordError(errDel)
				return errDel
			}

			log.Debug("Removed deprecated permissions batch", "migration", "removeDeprecatedPermissions", "pattern", permPattern, "count", n)
			return nil
		})

		batchSpan.End()

		if errBatchRemove != nil {
			log.Error("Could not remove deprecated permissions batch", "migration", "removeDeprecatedPermissions", "pattern", permPattern, "error", errBatchRemove)
			patternSpan.RecordError(errBatchRemove)
			patternSpan.End()
			return errBatchRemove
		}

		totalRemoved += len(permissions)
		patternSpan.SetAttributes(attribute.Int("permissions.removed", len(permissions)))
		log.Info("Removed deprecated permissions for pattern", "migration", "removeDeprecatedPermissions", "pattern", permPattern, "count", len(permissions))

		patternSpan.End()
	}

	span.SetAttributes(
		attribute.Int("permissions.total.removed", totalRemoved),
		attribute.Int("migration.duration.ms", int(time.Since(t).Milliseconds())),
	)

	log.Info("Completed migration to remove deprecated permissions", "migration", "removeDeprecatedPermissions", "totalRemoved", totalRemoved, "duration", time.Since(t))
	return nil
}

func trimToMaxLen(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen]
	}
	return s
}
