package migrations

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var tableLockerLog = log.New("migrations.table_locker")

type legacyTableLocker struct {
	sql legacysql.LegacyDatabaseProvider
}

// LockMigrationTables locks the legacy tables during migration to prevent concurrent writes.
func (l *legacyTableLocker) LockMigrationTables(ctx context.Context, tables []string) (func(context.Context) error, error) {
	if len(tables) == 0 {
		return func(context.Context) error { return nil }, nil
	}

	sqlHelper, err := l.sql(ctx)
	if err != nil {
		return nil, err
	}

	dbType := string(sqlHelper.DB.GetDBType())
	if dbType == "sqlite3" {
		// SQLite already has a shared session at this point
		return func(context.Context) error { return nil }, nil
	}

	quotedTables := make([]string, 0, len(tables))
	seen := make(map[string]struct{}, len(tables))
	for _, table := range tables {
		if table == "" {
			continue
		}
		if _, ok := seen[table]; ok {
			continue
		}
		seen[table] = struct{}{}
		quotedTables = append(quotedTables, sqlHelper.DB.Quote(sqlHelper.Table(table)))
	}
	if len(quotedTables) == 0 {
		return func(context.Context) error { return nil }, nil
	}

	switch dbType {
	case "mysql":
		return l.lockMySQL(ctx, sqlHelper, quotedTables)
	case "postgres":
		return l.lockPostgres(ctx, sqlHelper, quotedTables)
	default:
		return nil, fmt.Errorf("unsupported database type for migration lock: %s", dbType)
	}
}

// lockMySQL acquires READ locks on a dedicated connection outside the pool.
// This prevents LOCK TABLES from poisoning pooled connections (MySQL error 1100).
func (l *legacyTableLocker) lockMySQL(ctx context.Context, sqlHelper *legacysql.LegacyDatabaseHelper, quotedTables []string) (func(context.Context) error, error) {
	var lockSQL strings.Builder
	lockSQL.WriteString("LOCK TABLES ")
	for i, table := range quotedTables {
		if i > 0 {
			lockSQL.WriteString(", ")
		}
		lockSQL.WriteString(table)
		lockSQL.WriteString(" READ")
	}

	// Use a dedicated connection to not implicitly commit migration transaction.
	conn, err := sqlHelper.DB.GetEngine().DB().Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get dedicated connection for table lock: %w", err)
	}

	if _, err := conn.ExecContext(ctx, lockSQL.String()); err != nil {
		if closeErr := conn.Close(); closeErr != nil {
			tableLockerLog.Warn("failed to close connection after lock error", "error", closeErr)
		}
		return nil, err
	}

	return func(ctx context.Context) error {
		defer func() {
			if closeErr := conn.Close(); closeErr != nil {
				tableLockerLog.Warn("failed to close lock connection", "error", closeErr)
			}
		}()
		_, err := conn.ExecContext(ctx, "UNLOCK TABLES")
		return err
	}, nil
}

func (l *legacyTableLocker) lockPostgres(ctx context.Context, sqlHelper *legacysql.LegacyDatabaseHelper, quotedTables []string) (func(context.Context) error, error) {
	session := sqlHelper.DB.GetEngine().NewSession()
	session = session.Context(ctx)

	if err := session.Begin(); err != nil {
		session.Close()
		return nil, err
	}

	lockSQL := fmt.Sprintf("LOCK TABLE %s IN SHARE MODE", strings.Join(quotedTables, ", "))
	if _, err := session.Exec(lockSQL); err != nil {
		_ = session.Rollback()
		session.Close()
		return nil, err
	}

	return func(_ context.Context) error {
		defer session.Close()
		return session.Rollback()
	}, nil
}
