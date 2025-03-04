//go:build enterprise || pro

package migrator

import (
	"errors"
	"fmt"

	"cloud.google.com/go/spanner"
	"google.golang.org/grpc/codes"
	"xorm.io/core"
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
		t.AddColumn(core.NewColumn(c.Name, c.Name, core.SQLType{Name: c.Type}, c.Length, c.Length2, c.Nullable))
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
