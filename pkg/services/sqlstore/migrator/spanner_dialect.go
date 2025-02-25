package migrator

import (
	"cloud.google.com/go/spanner"
	"google.golang.org/grpc/codes"
	"xorm.io/core"
)

type SpannerDialect struct {
	BaseDialect
	d core.Dialect
}

func NewSpannerDialect() Dialect {
	d := SpannerDialect{d: core.QueryDialect("spanner")}
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

// FIXME: panics
func (s *SpannerDialect) UpsertMultipleSQL(tableName string, keyCols, updateCols []string, count int) (string, error) {
	panic("")
}
