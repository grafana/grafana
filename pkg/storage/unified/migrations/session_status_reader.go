package migrations

import (
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
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
		table := r.helper.Table(migrationLogTableName)
		exists, err := r.logTableExists(table)
		if err != nil {
			return contract.StorageModeLegacy, err
		}
		if exists {
			migrated, err := hasSuccessfulMigration(r.sess, table, id)
			if err != nil {
				return contract.StorageModeLegacy, err
			}
			if migrated {
				return contract.StorageModeUnified, nil
			}
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

func (r sessionStatusReader) logTableExists(table string) (bool, error) {
	database, name, qualified := strings.Cut(table, ".")
	var query string
	var args []any
	switch {
	case !qualified && r.helper.DB.GetDBType() == core.MYSQL:
		// The proxy selects the tenant schema on the server; xorm's DSN does not name it.
		query = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?"
		args = []any{table}
	case !qualified:
		return r.sess.IsTableExist(table)
	case r.helper.DB.GetDBType() == core.SQLITE:
		query = "SELECT COUNT(*) FROM " + r.helper.DB.Quote(database) + ".sqlite_master WHERE type = 'table' AND name = ?"
		args = []any{name}
	default:
		query = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?"
		args = []any{database, name}
	}
	var count int64
	_, err := r.sess.SQL(query, args...).Get(&count)
	return count > 0, err
}
