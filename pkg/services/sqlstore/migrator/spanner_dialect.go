//go:build enterprise || pro

package migrator

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/spanner"
	database "cloud.google.com/go/spanner/admin/database/apiv1"
	"cloud.google.com/go/spanner/admin/database/apiv1/databasepb"
	"github.com/googleapis/gax-go/v2"
	spannerdriver "github.com/googleapis/go-sql-spanner"
	"google.golang.org/grpc/codes"
	"xorm.io/xorm"

	"github.com/grafana/dskit/concurrency"
	utilspanner "github.com/grafana/grafana/pkg/util/spanner"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

type SpannerDialect struct {
	BaseDialect
	d core.Dialect
}

func init() {
	supportedDialects[Spanner] = NewSpannerDialect
}

func NewSpannerDialect() Dialect {
	d := SpannerDialect{d: core.QueryDialect(Spanner)}
	d.dialect = &d
	d.driverName = Spanner
	return &d
}

func (s *SpannerDialect) AutoIncrStr() string      { return s.d.AutoIncrStr() }
func (s *SpannerDialect) Quote(name string) string { return s.d.Quote(name) }
func (s *SpannerDialect) SupportEngine() bool      { return s.d.SupportEngine() }

func (s *SpannerDialect) LikeOperator(column string, wildcardBefore bool, pattern string, wildcardAfter bool) (string, string) {
	param := strings.ToLower(pattern)
	if wildcardBefore {
		param = "%" + param
	}
	if wildcardAfter {
		param = param + "%"
	}
	return fmt.Sprintf("LOWER(%s) LIKE ?", column), param
}

func (s *SpannerDialect) IndexCheckSQL(tableName, indexName string) (string, []any) {
	return s.d.IndexCheckSql(tableName, indexName)
}
func (s *SpannerDialect) SQLType(col *Column) string {
	c := core.NewColumn(col.Name, "", core.SQLType{Name: col.Type}, col.Length, col.Length2, col.Nullable)
	return s.d.SqlType(c)
}

func (s *SpannerDialect) BatchSize() int { return 1000 }

func (s *SpannerDialect) BooleanValue(b bool) any {
	return b
}

func (s *SpannerDialect) BooleanStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
func (s *SpannerDialect) ErrorMessage(err error) string {
	return spanner.ErrDesc(spanner.ToSpannerError(err))
}
func (s *SpannerDialect) IsDeadlock(err error) bool {
	return spanner.ErrCode(spanner.ToSpannerError(err)) == codes.Aborted
}
func (s *SpannerDialect) IsUniqueConstraintViolation(err error) bool {
	return spanner.ErrCode(spanner.ToSpannerError(err)) == codes.AlreadyExists
}

func (s *SpannerDialect) CreateTableSQL(table *Table) string {
	t := core.NewEmptyTable()
	t.Name = table.Name
	t.PrimaryKeys = table.PrimaryKeys
	for _, c := range table.Columns {
		col := core.NewColumn(c.Name, c.Name, core.SQLType{Name: c.Type}, c.Length, c.Length2, c.Nullable)
		col.IsAutoIncrement = c.IsAutoIncrement
		col.Default = c.Default
		t.AddColumn(col)
	}
	if len(t.PrimaryKeys) == 0 {
		for _, ix := range table.Indices {
			if ix.Name == "PRIMARY_KEY" {
				t.PrimaryKeys = append(t.PrimaryKeys, ix.Cols...)
			}
		}
	}
	return s.d.CreateTableSql(t, t.Name, "", "")
}

func (s *SpannerDialect) CreateIndexSQL(tableName string, index *Index) string {
	idx := core.NewIndex(index.Name, index.Type)
	idx.Cols = index.Cols
	return s.d.CreateIndexSql(tableName, idx)
}

func (s *SpannerDialect) UpsertMultipleSQL(tableName string, keyCols, updateCols []string, count int) (string, error) {
	return "", errors.New("not supported")
}

func (s *SpannerDialect) DropIndexSQL(tableName string, index *Index) string {
	return fmt.Sprintf("DROP INDEX %v", s.Quote(index.XName(tableName)))
}

func (s *SpannerDialect) DropTable(tableName string) string {
	return fmt.Sprintf("DROP TABLE %s", s.Quote(tableName))
}

func (s *SpannerDialect) ColStringNoPk(col *Column) string {
	sql := s.dialect.Quote(col.Name) + " "

	sql += s.dialect.SQLType(col) + " "

	if s.dialect.ShowCreateNull() && !col.Nullable {
		sql += "NOT NULL "
	}

	if col.Default != "" {
		// Default value must be in parentheses.
		sql += "DEFAULT (" + s.dialect.Default(col) + ") "
	}

	return sql
}

func (s *SpannerDialect) TruncateDBTables(engine *xorm.Engine) error {
	// Get tables names only, no columns or indexes.
	tables, err := engine.Dialect().GetTables()
	if err != nil {
		return err
	}
	sess := engine.NewSession()
	defer sess.Close()

	var statements []string

	for _, table := range tables {
		switch table.Name {
		case "":
			continue
		case "autoincrement_sequences":
			// Don't delete sequence number for migration_log.id column.
			statements = append(statements, fmt.Sprintf("DELETE FROM %v WHERE name <> 'migration_log:id'", s.Quote(table.Name)))
		case "migration_log":
			continue
		case "dashboard_acl":
			// keep default dashboard permissions
			statements = append(statements, fmt.Sprintf("DELETE FROM %v WHERE dashboard_id != -1 AND org_id != -1;", s.Quote(table.Name)))
		default:
			statements = append(statements, fmt.Sprintf("DELETE FROM %v WHERE TRUE;", s.Quote(table.Name)))
		}
	}

	// Run statements concurrently.
	return concurrency.ForEachJob(context.Background(), len(statements), 10, func(ctx context.Context, idx int) error {
		_, err := sess.Exec(statements[idx])
		return err
	})
}

// CleanDB drops all existing tables and their indexes.
func (s *SpannerDialect) CleanDB(engine *xorm.Engine) error {
	tables, err := engine.DBMetas()
	if err != nil {
		return err
	}

	// Collect all DROP statements.
	changeStreams, err := s.findChangeStreams(engine)
	if err != nil {
		return err
	}
	statements := make([]string, 0, len(tables)+len(changeStreams))
	for _, cs := range changeStreams {
		statements = append(statements, fmt.Sprintf("DROP CHANGE STREAM `%s`", cs))
	}

	for _, table := range tables {
		// Indexes must be dropped first, otherwise dropping tables fails.
		for _, index := range table.Indexes {
			if !index.IsRegular {
				// Don't drop primary key.
				continue
			}
			sql := fmt.Sprintf("DROP INDEX %s", s.Quote(index.XName(table.Name)))
			statements = append(statements, sql)
		}

		sql := fmt.Sprintf("DROP TABLE %s", s.Quote(table.Name))
		statements = append(statements, sql)
	}

	if len(statements) == 0 {
		return nil
	}

	return s.executeDDLStatements(context.Background(), engine, statements)
}

//go:embed snapshot/spanner-ddl.json
var snapshotDDL string

//go:embed snapshot/spanner-log.json
var snapshotMigrations string

func (s *SpannerDialect) CreateDatabaseFromSnapshot(ctx context.Context, engine *xorm.Engine, tableName string) error {
	var statements, migrationIDs []string
	err := json.Unmarshal([]byte(snapshotDDL), &statements)
	if err != nil {
		return err
	}
	err = json.Unmarshal([]byte(snapshotMigrations), &migrationIDs)
	if err != nil {
		return err
	}

	err = s.executeDDLStatements(ctx, engine, statements)
	if err != nil {
		return err
	}

	return s.recordMigrationsToMigrationLog(engine, migrationIDs, tableName)
}

func (s *SpannerDialect) recordMigrationsToMigrationLog(engine *xorm.Engine, migrationIDs []string, tableName string) error {
	now := time.Now()
	makeRecord := func(id string) MigrationLog {
		return MigrationLog{
			MigrationID: id,
			SQL:         "",
			Success:     true,
			Timestamp:   now,
		}
	}

	sess := engine.NewSession()
	defer sess.Close()

	// Insert records in batches to avoid many roundtrips to database.
	// Inserting all records at once fails due to "Number of parameters in query exceeds the maximum
	// allowed limit of 950." error, so we use smaller batches.
	const batchSize = 100

	if err := sess.Begin(); err != nil {
		return err
	}

	records := make([]MigrationLog, 0, len(migrationIDs))
	for _, mid := range migrationIDs {
		records = append(records, makeRecord(mid))

		if len(records) >= batchSize {
			if _, err := sess.Table(tableName).InsertMulti(records); err != nil {
				err2 := sess.Rollback()
				return errors.Join(fmt.Errorf("failed to insert migration logs: %w", err), err2)
			}
			records = records[:0]
		}
	}

	// Insert remaining records.
	if len(records) > 0 {
		if _, err := sess.Table(tableName).InsertMulti(records); err != nil {
			err2 := sess.Rollback()
			return errors.Join(fmt.Errorf("failed to insert migration logs: %w", err), err2)
		}
	}

	if err := sess.Commit(); err != nil {
		return err
	}

	return nil
}

// Spanner can be very slow at executing single DDL statements (it can take up to a minute), but when
// many DDL statements are batched together, Spanner is *much* faster (total time to execute all statements
// is often in tens of seconds). We can't execute batch of DDL statements using sql wrapper, we use "database admin client"
// from Spanner library instead.
func (s *SpannerDialect) executeDDLStatements(ctx context.Context, engine *xorm.Engine, statements []string) error {
	// Datasource name contains string used for sql.Open.
	dsn := engine.Dialect().DataSourceName()
	cfg, err := spannerdriver.ExtractConnectorConfig(dsn)
	if err != nil {
		return err
	}

	opts := utilspanner.ConnectorConfigToClientOptions(cfg)

	databaseAdminClient, err := database.NewDatabaseAdminClient(ctx, opts...)
	if err != nil {
		return fmt.Errorf("failed to create database admin client: %v", err)
	}
	//nolint:errcheck // If the databaseAdminClient.Close fails, we simply don't care.
	defer databaseAdminClient.Close()

	databaseName := fmt.Sprintf("projects/%s/instances/%s/databases/%s", cfg.Project, cfg.Instance, cfg.Database)

	op, err := databaseAdminClient.UpdateDatabaseDdl(ctx, &databasepb.UpdateDatabaseDdlRequest{
		Database:   databaseName,
		Statements: statements,
	}, gax.WithTimeout(0)) /* disable default timeout */
	if err != nil {
		return fmt.Errorf("failed to start database DDL update: %v", err)
	}

	err = op.Wait(ctx, gax.WithTimeout(0)) /* disable default timeout */
	if err != nil {
		return fmt.Errorf("failed to apply database DDL update: %v", err)
	}
	return nil
}

func (s *SpannerDialect) UnionDistinct() string {
	return "UNION DISTINCT"
}

func (s *SpannerDialect) findChangeStreams(engine *xorm.Engine) ([]string, error) {
	var result []string
	query := `SELECT c.CHANGE_STREAM_NAME
	FROM INFORMATION_SCHEMA.CHANGE_STREAMS AS C
	WHERE C.CHANGE_STREAM_CATALOG=''
	AND C.CHANGE_STREAM_SCHEMA=''`
	rows, err := engine.DB().Query(query)
	if err != nil {
		return nil, err
	}
	//nolint:errcheck // If the rows.Close fails, we simply don't care.
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		result = append(result, name)
	}
	return result, nil
}
