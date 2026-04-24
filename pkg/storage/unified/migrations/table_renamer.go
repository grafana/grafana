package migrations

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const legacySuffix = "_legacy"

// MigrationTableRenamer renames legacy tables after a successful migration.
type MigrationTableRenamer interface {
	// Init configures the renamer with the session and migrator for this migration run.
	// Must be called before RenameTables or RecoverRenamedTables.
	Init(sess *xorm.Session, mg *migrator.Migrator)

	// RenameTables renames the given tables with a _legacy suffix.
	// doUnlock should release the migration table lock.
	RenameTables(ctx context.Context, tables []string, doUnlock func(ctx context.Context) error) error

	// RecoverRenamedTables restores _legacy tables back to their original names
	// so the migration can re-run. This handles crash recovery (partial rename from
	// a previous failed run) and manual re-migration (operator deleted the log entry).
	RecoverRenamedTables(tables []string) error
}

// newTableRenamer returns the appropriate renamer for the database type.
func newTableRenamer(dbType string, log log.Logger, waitDeadline time.Duration) MigrationTableRenamer {
	switch dbType {
	case "mysql":
		if waitDeadline == 0 {
			waitDeadline = time.Minute
		}
		return &mysqlTableRenamer{log: log, waitDeadline: waitDeadline}
	default:
		return &transactionalTableRenamer{log: log}
	}
}

// transactionalTableRenamer renames tables on the same session (Postgres/SQLite).
// DDL is transactional on these databases.
type transactionalTableRenamer struct {
	log  log.Logger
	sess *xorm.Session
	mg   *migrator.Migrator
}

func (r *transactionalTableRenamer) Init(sess *xorm.Session, mg *migrator.Migrator) {
	r.sess = sess
	r.mg = mg
}

func (r *transactionalTableRenamer) RecoverRenamedTables(tables []string) error {
	for _, table := range tables {
		legacyName := table + legacySuffix
		legacyExists, err := r.mg.DBEngine.IsTableExist(legacyName)
		if err != nil {
			return fmt.Errorf("failed to check if table %q exists: %w", legacyName, err)
		}
		originalExists, err := r.mg.DBEngine.IsTableExist(table)
		if err != nil {
			return fmt.Errorf("failed to check if table %q exists: %w", table, err)
		}
		switch {
		case !legacyExists && !originalExists:
			return fmt.Errorf("neither %q nor %q exist, tables are missing, manual intervention required", table, legacyName)
		case legacyExists && originalExists:
			return fmt.Errorf("both %q and %q exist, unexpected state, manual intervention required", table, legacyName)
		case originalExists:
			continue // normal state, nothing to recover
		default: // legacyExists && !originalExists, needs recovery
			// Use mg.DBEngine (not sess) so the table is visible to other connections.
			// Migrators read legacy tables through separate sessions/gRPC.
			restoreSQL := r.mg.Dialect.RenameTable(legacyName, table)
			r.log.Info("Restoring renamed table", "from", legacyName, "to", table)
			if _, err := r.mg.DBEngine.Exec(restoreSQL); err != nil {
				return fmt.Errorf("failed to restore table %q to %q: %w", legacyName, table, err)
			}
		}
	}
	return nil
}

func (r *transactionalTableRenamer) RenameTables(_ context.Context, tables []string, _ func(ctx context.Context) error) error {
	toRename, err := buildRenamePairs(r.log, r.mg, tables)
	if err != nil {
		return err
	}

	if len(toRename) == 0 {
		return nil
	}

	for _, p := range toRename {
		renameSQL := r.mg.Dialect.RenameTable(p.oldName, p.newName)
		r.log.Info("renaming legacy table", "table", p.oldName, "newName", p.newName, "sql", renameSQL)
		if _, err := r.sess.Exec(renameSQL); err != nil {
			return fmt.Errorf("failed to rename table %q to %q: %w", p.oldName, p.newName, err)
		}
	}
	return nil
}

// mysqlTableRenamer queues one RENAME per table on separate connections, waits for
// all to reach metadata-lock-wait state, then releases the READ lock so DDL priority
// ensures renames execute before any pending DML.
type mysqlTableRenamer struct {
	log          log.Logger
	sess         *xorm.Session
	mg           *migrator.Migrator
	waitDeadline time.Duration // 0 means 1 minute
}

func (r *mysqlTableRenamer) Init(sess *xorm.Session, mg *migrator.Migrator) {
	r.sess = sess
	r.mg = mg
}

func (r *mysqlTableRenamer) RecoverRenamedTables(tables []string) error {
	for _, table := range tables {
		legacyName := table + legacySuffix
		legacyExists, err := r.mg.DBEngine.IsTableExist(legacyName)
		if err != nil {
			return fmt.Errorf("failed to check if table %q exists: %w", legacyName, err)
		}
		originalExists, err := r.mg.DBEngine.IsTableExist(table)
		if err != nil {
			return fmt.Errorf("failed to check if table %q exists: %w", table, err)
		}
		switch {
		case !legacyExists && !originalExists:
			return fmt.Errorf("neither %q nor %q exist, tables are missing, manual intervention required", table, legacyName)
		case legacyExists && originalExists:
			return fmt.Errorf("both %q and %q exist, unexpected state, manual intervention required", table, legacyName)
		case originalExists:
			continue // normal state, nothing to recover
		default: // legacyExists && !originalExists — needs recovery
			restoreSQL := r.mg.Dialect.RenameTable(legacyName, table)
			r.log.Info("Restoring renamed table", "from", legacyName, "to", table)
			if _, err := r.mg.DBEngine.Exec(restoreSQL); err != nil {
				return fmt.Errorf("failed to restore table %q to %q: %w", legacyName, table, err)
			}
		}
	}
	return nil
}

// renameResult pairs a rename operation with its outcome.
type renameResult struct {
	pair renamePair
	err  error
}

func (r *mysqlTableRenamer) RenameTables(ctx context.Context, tables []string, doUnlock func(ctx context.Context) error) error {
	tablesToRename, err := buildRenamePairs(r.log, r.mg, tables)
	if err != nil {
		return fmt.Errorf("failed to build rename pairs: %w", err)
	}
	if len(tablesToRename) == 0 {
		return nil
	}

	renameCtx, cancel := context.WithCancel(ctx)
	defer cancel() // abort in-flight renames

	results := make(chan renameResult, len(tablesToRename))
	for _, pair := range tablesToRename {
		go func(p renamePair) {
			conn, err := r.mg.DBEngine.DB().Conn(renameCtx)
			if err != nil {
				results <- renameResult{pair: p, err: fmt.Errorf("failed to get connection for RENAME %q: %w", p.oldName, err)}
				return
			}
			defer func() { _ = conn.Close() }()

			renameSQL := fmt.Sprintf("RENAME TABLE %s TO %s", r.mg.Dialect.Quote(p.oldName), r.mg.Dialect.Quote(p.newName))
			_, err = conn.ExecContext(renameCtx, renameSQL)
			results <- renameResult{pair: p, err: err}
		}(pair)
	}

	if err := r.waitForRenamesQueued(ctx, tablesToRename); err != nil {
		return fmt.Errorf("aborting rename: not all RENAME statements confirmed queued (set disable_legacy_table_rename=true to skip renaming): %w", err)
	}
	err = doUnlock(ctx)
	if err != nil {
		return fmt.Errorf("failed to release lock for MySQL RENAME TABLE: %w", err)
	}

	// Collect all results; rollback successful renames if any failed.
	resultDeadline := time.NewTimer(r.waitDeadline)
	defer resultDeadline.Stop()

	renameResults := make([]renameResult, 0, len(tablesToRename))
	var firstErr error
	for range tablesToRename {
		select {
		case res := <-results:
			renameResults = append(renameResults, res)
			if res.err != nil && firstErr == nil {
				firstErr = res.err
			}
		case <-ctx.Done():
			r.rollbackRenames(renameResults)
			return fmt.Errorf("context cancelled while waiting for RENAME TABLE to complete: %w", ctx.Err())
		case <-resultDeadline.C:
			r.rollbackRenames(renameResults)
			return fmt.Errorf("timeout: only %d of %d RENAME TABLE statements completed", len(renameResults), len(tablesToRename))
		}
	}
	if firstErr != nil {
		r.rollbackRenames(renameResults)
		return fmt.Errorf("MySQL RENAME TABLE failed: %w", firstErr)
	}
	return nil
}

// waitForRenamesQueued polls information_schema.processlist via sess to confirm all
// RENAME statements are waiting for metadata locks. Returns error on timeout.
// NOTE: This relies on exact text matching of the info column in processlist against
// the SQL we generate. If MySQL ever normalizes the SQL (quoting, casing, whitespace),
// the match will fail and this will timeout. This is acceptable because we control
// the SQL generation in RenameTables above.
func (r *mysqlTableRenamer) waitForRenamesQueued(ctx context.Context, pairs []renamePair) error {
	deadline := time.NewTimer(r.waitDeadline)
	defer deadline.Stop()

	for {
		found := 0
		for _, p := range pairs {
			exactMatch := fmt.Sprintf("RENAME TABLE %s TO %s", r.mg.Dialect.Quote(p.oldName), r.mg.Dialect.Quote(p.newName))
			var count int
			_, err := r.sess.SQL(
				"SELECT COUNT(*) FROM information_schema.processlist "+
					"WHERE state = 'Waiting for table metadata lock' AND info = ?",
				exactMatch).Get(&count)
			if err != nil {
				return err
			}
			if count > 0 {
				found++
			}
		}
		if found >= len(pairs) {
			r.log.Info("All MySQL RENAME TABLE statements queued", "count", found)
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("context cancelled while waiting for RENAME statements to queue: %w", ctx.Err())
		case <-deadline.C:
			return fmt.Errorf("timeout: only %d of %d RENAME statements confirmed in processlist", found, len(pairs))
		case <-time.After(100 * time.Millisecond):
		}
	}
}

// rollbackRenames reverses successful renames when some failed, keeping DB consistent.
func (r *mysqlTableRenamer) rollbackRenames(results []renameResult) {
	for _, res := range results {
		if res.err != nil {
			continue
		}
		rollbackSQL := fmt.Sprintf("RENAME TABLE %s TO %s", r.mg.Dialect.Quote(res.pair.newName), r.mg.Dialect.Quote(res.pair.oldName))
		r.log.Warn("Rolling back successful rename due to other rename failure",
			"table", res.pair.oldName, "sql", rollbackSQL)
		if _, err := r.mg.DBEngine.Exec(rollbackSQL); err != nil {
			r.log.Error("Failed to rollback rename",
				"table", res.pair.oldName, "newName", res.pair.newName, "error", err)
		}
	}
}

// renamePair holds the old and new names for a table rename.
type renamePair struct {
	oldName string
	newName string
}

// buildRenamePairs returns tables needing rename. Skips already-renamed tables.
func buildRenamePairs(log log.Logger, mg *migrator.Migrator, tables []string) ([]renamePair, error) {
	var toRename []renamePair

	for _, table := range tables {
		newName := table + legacySuffix

		sourceExists, err := mg.DBEngine.IsTableExist(table)
		if err != nil {
			return nil, fmt.Errorf("failed to check if table %q exists: %w", table, err)
		}

		targetExists, err := mg.DBEngine.IsTableExist(newName)
		if err != nil {
			return nil, fmt.Errorf("failed to check if table %q exists: %w", newName, err)
		}

		switch {
		case !sourceExists && targetExists:
			log.Info("table already renamed, skipping", "table", table, "newName", newName)
			continue
		case !sourceExists:
			return nil, fmt.Errorf("table %q does not exist and neither does %q", table, newName)
		case targetExists:
			return nil, fmt.Errorf("both %q and %q exist, unexpected state", table, newName)
		default:
			toRename = append(toRename, renamePair{oldName: table, newName: newName})
		}
	}

	return toRename, nil
}
