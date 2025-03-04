//go:build enterprise || pro

package migrator

import (
	"errors"
	"fmt"

	"cloud.google.com/go/spanner"
	"google.golang.org/grpc/codes"
	"xorm.io/core"

	"xorm.io/xorm"
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
	d.BaseDialect.dialect = &d
	d.BaseDialect.driverName = Spanner
	return &d
}

func (s *SpannerDialect) AutoIncrStr() string      { return s.d.AutoIncrStr() }
func (s *SpannerDialect) Quote(name string) string { return s.d.Quote(name) }
func (s *SpannerDialect) SupportEngine() bool      { return s.d.SupportEngine() }
func (s *SpannerDialect) IndexCheckSQL(tableName, indexName string) (string, []any) {
	return s.d.IndexCheckSql(tableName, indexName)
}
func (s *SpannerDialect) SQLType(col *Column) string {
	c := core.NewColumn(col.Name, "", core.SQLType{Name: col.Type}, col.Length, col.Length2, col.Nullable)
	return s.d.SqlType(c)
}

func (s *SpannerDialect) BatchSize() int { return 1000 }
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
		t.AddColumn(col)
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

	if s.dialect.ShowCreateNull() {
		if col.Nullable {
			// Nothing. Columns are nullable by default.
		} else {
			sql += "NOT NULL "
		}
	}

	if col.Default != "" {
		// Default value must be in parentheses.
		sql += "DEFAULT (" + s.dialect.Default(col) + ") "
	}

	return sql
}

func (s *SpannerDialect) TruncateDBTables(engine *xorm.Engine) error {
	tables, err := engine.DBMetas()
	if err != nil {
		return err
	}
	sess := engine.NewSession()
	defer sess.Close()

	for _, table := range tables {
		switch table.Name {
		case "":
			continue
		case "migration_log":
			continue
		case "dashboard_acl":
			// keep default dashboard permissions
			if _, err := sess.Exec(fmt.Sprintf("DELETE FROM %v WHERE dashboard_id != -1 AND org_id != -1;", s.Quote(table.Name))); err != nil {
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}
		default:
			if _, err := sess.Exec(fmt.Sprintf("DELETE FROM %v WHERE TRUE;", s.Quote(table.Name))); err != nil {
				return fmt.Errorf("failed to truncate table %q: %w", table.Name, err)
			}
		}
	}

	return nil
}

// CleanDB drops all tables and their indexes. Unfortunately Spanner is super-slow at dropping and creating tables and
// indexes (30s-60s per index/table) so it's better not to use this.
func (s *SpannerDialect) CleanDB(engine *xorm.Engine) error {
	tables, err := engine.DBMetas()
	if err != nil {
		return err
	}
	sess := engine.NewSession()
	defer sess.Close()

	for _, table := range tables {
		// Indexes must be dropped first, otherwise dropping tables fails.
		for _, index := range table.Indexes {
			if !index.IsRegular {
				// Don't drop primary key.
				continue
			}
			//fmt.Println("Dropping index... ", index.XName(table.Name))
			if _, err := sess.Exec(fmt.Sprintf("DROP INDEX %s", s.Quote(index.XName(table.Name)))); err != nil {
				return fmt.Errorf("failed to drop index %q: %w", table.Name, err)
			}
		}

		//fmt.Println("Dropping table... ", table.Name)
		if _, err := sess.Exec(fmt.Sprintf("DROP TABLE %s", s.Quote(table.Name))); err != nil {
			return fmt.Errorf("failed to delete table %q: %w", table.Name, err)
		}
	}

	return nil
}
