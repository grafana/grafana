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
		"apikeys:", // remove this line in 2026/03, no apikeys:read/write/create should exist by then and downgrade/upgrade scenarios are less likely
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
			return sess.SQL("SELECT id FROM permission WHERE action LIKE ?", permPattern+"%").Find(&permissions)
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

		// Remove permissions by the exact IDs we found
		if errDel := db.GetSqlxSession().WithTransaction(patternCtx, func(tx *session.SessionTx) error {
			delQuery := "DELETE FROM permission WHERE id IN ("
			delArgs := make([]any, 0, len(permissions))
			for i := range permissions {
				delQuery += "?,"
				delArgs = append(delArgs, permissions[i].ID)
			}
			// close the IN clause
			delQuery = delQuery[:len(delQuery)-1] + ")"

			_, err := tx.Exec(patternCtx, delQuery, delArgs...)
			return err
		}); errDel != nil {
			log.Error("Error deleting deprecated permissions", "migration", "removeDeprecatedPermissions", "pattern", permPattern, "error", errDel)
			patternSpan.RecordError(errDel)
			patternSpan.End()
			return errDel
		}

		// We previously fetched matching permissions; count them as removed
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
