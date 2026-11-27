package migrations

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/go-sql-driver/mysql"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

// NewSessionStatusReader reads migration status through an already resolved tenant session.
// It does not cache results or bootstrap the migration log. Use it only within that session.
func NewSessionStatusReader(sess *sqlstore.DBSession, helper *legacysql.LegacyDatabaseHelper, cfg *setting.Cfg, migrationIDs map[schema.GroupResource]string) contract.MigrationStatusReader {
	return sessionStatusReader{sess: sess, helper: helper, cfg: cfg, migrationIDs: migrationIDs}
}

type sessionStatusReader struct {
	sess         *sqlstore.DBSession
	helper       *legacysql.LegacyDatabaseHelper
	cfg          *setting.Cfg
	migrationIDs map[schema.GroupResource]string
}

func (r sessionStatusReader) GetStorageMode(ctx context.Context, resource schema.GroupResource) (contract.StorageMode, error) {
	if err := ctx.Err(); err != nil {
		return contract.StorageModeLegacy, err
	}
	if id, ok := r.migrationIDs[resource]; ok {
		migrated, err := r.hasSuccessfulMigration(id)
		if err != nil {
			return contract.StorageModeLegacy, fmt.Errorf("check tenant migration status: %w", err)
		}
		if migrated {
			return contract.StorageModeUnified, nil
		}
	}
	if r.cfg != nil {
		mode := r.cfg.UnifiedStorage[resource.String()].DualWriterMode
		switch {
		case mode >= grafanarest.Mode4:
			return contract.StorageModeUnified, nil
		case mode >= grafanarest.Mode1:
			return contract.StorageModeDualWrite, nil
		}
	}
	return contract.StorageModeLegacy, nil
}

// This reader only resolves storage mode; it has no served-version metadata.
func (sessionStatusReader) GetFloorVersion(schema.GroupResource) (string, bool) { return "", false }

func (r sessionStatusReader) hasSuccessfulMigration(id string) (bool, error) {
	table := r.helper.Table(migrationLogTableName)
	if strings.Contains(table, ".") || r.helper.DB.GetDBType() != core.MYSQL {
		exists, err := r.logTableExists(table)
		if err != nil || !exists {
			return false, err
		}
		return hasSuccessfulMigration(r.sess, table, id)
	}

	// The proxy selects the tenant schema and does not support system schema queries.
	rows, err := r.sess.QueryRows("SELECT COUNT(*) FROM "+r.helper.DB.Quote(table)+" WHERE migration_id = ? AND success = ?", id, true)
	if err != nil {
		if isMySQLMissingTable(err) {
			return false, nil
		}
		return false, err
	}
	defer func() { _ = rows.Close() }()
	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return false, err
		}
		return false, sql.ErrNoRows
	}
	var count int64
	if err := rows.Scan(&count); err != nil {
		return false, err
	}
	if rows.Next() {
		return false, errors.New("migration count returned more than one row")
	}
	// Do not use the count until the proxy stream has completed successfully.
	if err := rows.Err(); err != nil {
		return false, err
	}
	return count > 0, nil
}

func isMySQLMissingTable(err error) bool {
	const missingTable = 1146
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number == missingTable
	}
	st, ok := status.FromError(err)
	if !ok || st.Code() != codes.FailedPrecondition {
		return false
	}
	for _, detail := range st.Details() {
		if queryErr, ok := detail.(*dbproxyv1.QueryError); ok &&
			queryErr.GetReason() == dbproxyv1.ErrorReason_ERROR_REASON_SQL_ERROR && queryErr.GetDatabaseError().GetCode() == "1146" {
			return true
		}
	}
	return false
}

func (r sessionStatusReader) logTableExists(table string) (bool, error) {
	database, name, qualified := strings.Cut(table, ".")
	var query string
	var args []any
	switch {
	case !qualified:
		return r.sess.IsTableExist(table)
	case r.helper.DB.GetDBType() == core.SQLITE:
		query = "SELECT COUNT(*) FROM " + r.helper.DB.Quote(database) + ".sqlite_master WHERE type = 'table' AND name = ?"
		args = []any{name}
	default:
		query = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?"
		args = []any{database, name}
	}
	count, err := r.sess.SQL(query, args...).Count()
	return count > 0, err
}
