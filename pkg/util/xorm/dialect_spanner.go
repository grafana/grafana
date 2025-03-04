//go:build enterprise || pro

package xorm

import (
	"strings"

	_ "github.com/googleapis/go-sql-spanner"
	"xorm.io/core"
)

func init() {
	core.RegisterDriver("spanner", &spannerDriver{})
	core.RegisterDialect("spanner", func() core.Dialect { return &spanner{} })
}

// https://cloud.google.com/spanner/docs/reference/standard-sql/lexical#reserved_keywords
var spannerReservedKeywords = map[string]struct{}{
	"ALL":                  {},
	"AND":                  {},
	"ANY":                  {},
	"ARRAY":                {},
	"AS":                   {},
	"ASC":                  {},
	"ASSERT_ROWS_MODIFIED": {},
	"AT":                   {},
	"BETWEEN":              {},
	"BY":                   {},
	"CASE":                 {},
	"CAST":                 {},
	"COLLATE":              {},
	"CONTAINS":             {},
	"CREATE":               {},
	"CROSS":                {},
	"CUBE":                 {},
	"CURRENT":              {},
	"DEFAULT":              {},
	"DEFINE":               {},
	"DESC":                 {},
	"DISTINCT":             {},
	"ELSE":                 {},
	"END":                  {},
	"ENUM":                 {},
	"ESCAPE":               {},
	"EXCEPT":               {},
	"EXCLUDE":              {},
	"EXISTS":               {},
	"EXTRACT":              {},
	"FALSE":                {},
	"FETCH":                {},
	"FOLLOWING":            {},
	"FOR":                  {},
	"FROM":                 {},
	"FULL":                 {},
	"GROUP":                {},
	"GROUPING":             {},
	"GROUPS":               {},
	"HASH":                 {},
	"HAVING":               {},
	"IF":                   {},
	"IGNORE":               {},
	"IN":                   {},
	"INNER":                {},
	"INTERSECT":            {},
	"INTERVAL":             {},
	"INTO":                 {},
	"IS":                   {},
	"JOIN":                 {},
	"LATERAL":              {},
	"LEFT":                 {},
	"LIKE":                 {},
	"LIMIT":                {},
	"LOOKUP":               {},
	"MERGE":                {},
	"NATURAL":              {},
	"NEW":                  {},
	"NO":                   {},
	"NOT":                  {},
	"NULL":                 {},
	"NULLS":                {},
	"OF":                   {},
	"ON":                   {},
	"OR":                   {},
	"ORDER":                {},
	"OUTER":                {},
	"OVER":                 {},
	"PARTITION":            {},
	"PRECEDING":            {},
	"PROTO":                {},
	"RANGE":                {},
	"RECURSIVE":            {},
	"RESPECT":              {},
	"RIGHT":                {},
	"ROLLUP":               {},
	"ROWS":                 {},
	"SELECT":               {},
	"SET":                  {},
	"SOME":                 {},
	"STRUCT":               {},
	"TABLESAMPLE":          {},
	"THEN":                 {},
	"TO":                   {},
	"TREAT":                {},
	"TRUE":                 {},
	"UNBOUNDED":            {},
	"UNION":                {},
	"UNNEST":               {},
	"USING":                {},
	"WHEN":                 {},
	"WHERE":                {},
	"WINDOW":               {},
	"WITH":                 {},
	"WITHIN":               {},
}

type spannerDriver struct{}

func (d *spannerDriver) Parse(_driverName, datasourceName string) (*core.Uri, error) {
	return &core.Uri{DbType: "spanner", DbName: datasourceName}, nil
}

type spanner struct {
	core.Base
}

func (s *spanner) Init(db *core.DB, uri *core.Uri, driverName string, datasourceName string) error {
	return s.Base.Init(db, s, uri, driverName, datasourceName)
}
func (s *spanner) Filters() []core.Filter { return []core.Filter{&core.IdFilter{}} }
func (s *spanner) IsReserved(name string) bool {
	_, exists := spannerReservedKeywords[name]
	return exists
}
func (s *spanner) AndStr() string            { return "AND" }
func (s *spanner) OrStr() string             { return "OR" }
func (s *spanner) EqStr() string             { return "=" }
func (s *spanner) RollBackStr() string       { return "ROLL BACK" }
func (s *spanner) AutoIncrStr() string       { return "" }    // Spanner does not support auto-increment
func (s *spanner) SupportInsertMany() bool   { return false } // Needs manual transaction batching
func (s *spanner) SupportEngine() bool       { return false } // No support for engine selection
func (s *spanner) SupportCharset() bool      { return false } // ...or charsets
func (s *spanner) SupportDropIfExists() bool { return false } // Drop should be handled differently
func (s *spanner) IndexOnTable() bool        { return false }
func (s *spanner) ShowCreateNull() bool      { return false }
func (s *spanner) Quote(name string) string  { return "`" + name + "`" }
func (s *spanner) SqlType(col *core.Column) string {
	switch col.SQLType.Name {
	case core.Int, core.BigInt:
		return "INT64"
	case core.Varchar, core.Text:
		return "STRING(MAX)"
	case core.Bool:
		return "BOOL"
	case core.Float, core.Double:
		return "FLOAT64"
	case core.Bytea:
		return "BYTES(MAX)"
	case core.DateTime, core.TimeStamp:
		return "TIMESTAMP"
	default:
		return "STRING(MAX)" // XXX: more types to add
	}
}

func (s *spanner) GetColumns(tableName string) ([]string, map[string]*core.Column, error) {
	query := `SELECT COLUMN_NAME, SPANNER_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName`
	rows, err := s.DB().Query(query, map[string]any{"tableName": tableName})
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	columns := make(map[string]*core.Column)
	var colNames []string

	var name, sqlType, isNullable string
	for rows.Next() {
		if err := rows.Scan(&name, &sqlType, &isNullable); err != nil {
			return nil, nil, err
		}

		col := &core.Column{
			Name:     name,
			SQLType:  core.SQLType{Name: sqlType},
			Nullable: isNullable == "YES",
		}
		columns[name] = col
		colNames = append(colNames, name)
	}

	return colNames, columns, nil
}

func (s *spanner) CreateTableSql(table *core.Table, tableName, _, charset string) string {
	sql := "CREATE TABLE " + s.Quote(tableName) + " ("

	for i, col := range table.Columns() {
		if i > 0 {
			sql += ", "
		}
		sql += s.Quote(col.Name) + " " + s.SqlType(col)
		if col.IsPrimaryKey {
			sql += " PRIMARY KEY"
		}
	}

	sql += ") PRIMARY KEY (" + strings.Join(table.PrimaryKeys, ",") + ")"
	return sql
}

func (s *spanner) CreateIndexSql(tableName string, index *core.Index) string {
	sql := "CREATE "
	if index.Type == core.UniqueType {
		sql += "UNIQUE NULL_FILTERED "
	}
	sql += "INDEX " + s.Quote(index.XName(tableName)) + " ON " + s.Quote(tableName) + " (" + strings.Join(index.Cols, ", ") + ")"
	return sql
}

func (s *spanner) IndexCheckSql(tableName, indexName string) (string, []any) {
	return `SELECT index_name FROM information_schema.indexes
	        WHERE table_name = ? AND table_schema = "" AND index_name = ?`,
		[]any{tableName, indexName}
}

func (s *spanner) TableCheckSql(tableName string) (string, []any) {
	return `SELECT table_name FROM information_schema.tables
	        WHERE table_name = ? AND table_schema = ""`,
		[]any{tableName}
}

func (s *spanner) GetTables() ([]*core.Table, error) {
	res, err := s.DB().Query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = ""
	`)
	if err != nil {
		return nil, err
	}
	defer res.Close()

	tables := []*core.Table{}
	for res.Next() {
		var name string
		if err := res.Scan(&name); err != nil {
			return nil, err
		}
		t := core.NewEmptyTable()
		t.Name = name
		tables = append(tables, t)
	}
	return tables, nil
}

func (s *spanner) GetIndexes(tableName string) (map[string]*core.Index, error) {
	res, err := s.DB().Query(`
		SELECT index_name, index_type, is_unique FROM information_schema.tables
		WHERE table_name = ? AND table_schema = ""
  `, []any{tableName})
	if err != nil {
		return nil, err
	}
	defer res.Close()

	indices := map[string]*core.Index{}
	for res.Next() {
		index := struct {
			Name     string `xorm:"index_name"`
			Type     string `xorm:"index_type"`
			IsUnqiue bool   `xorm:"is_unique"`
		}{}
		err := res.Scan(&index)
		if err != nil {
			return nil, err
		}
		switch {
		case index.Type == "INDEX":
			indices[index.Name] = core.NewIndex(index.Name, core.IndexType)
		case index.Type == "PRIMARY_KEY", index.IsUnqiue:
			indices[index.Name] = core.NewIndex(index.Name, core.UniqueType)
		}
	}
	return indices, nil
}
