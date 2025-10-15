package xorm

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/ydb-platform/ydb-go-sdk/v3"

	"github.com/grafana/grafana/pkg/util/xorm/core"
)

// type ydbDriver struct {
// }

// func (p *ydbDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
// 	// if strings.Contains(dataSourceName, "?") {
// 	// 	dataSourceName = dataSourceName[:strings.Index(dataSourceName, "?")]
// 	// }

// 	return &core.Uri{DbType: core.YDB, DbName: dataSourceName}, nil
// }

// from https://github.com/ydb-platform/ydb/blob/main/ydb/library/yql/sql/v1/SQLv1.g.in#L1117
var (
	ydbReservedWords = map[string]bool{
		"ABORT":             true,
		"ACTION":            true,
		"ADD":               true,
		"AFTER":             true,
		"ALL":               true,
		"ALTER":             true,
		"ANALYZE":           true,
		"AND":               true,
		"ANSI":              true,
		"ANY":               true,
		"ARRAY":             true,
		"AS":                true,
		"ASC":               true,
		"ASSUME":            true,
		"ASYNC":             true,
		"ATTACH":            true,
		"AUTOINCREMENT":     true,
		"AUTOMAP":           true,
		"BEFORE":            true,
		"BEGIN":             true,
		"BERNOULLI":         true,
		"BETWEEN":           true,
		"BITCAST":           true,
		"BY":                true,
		"CALLABLE":          true,
		"CASCADE":           true,
		"CASE":              true,
		"CAST":              true,
		"CHANGEFEED":        true,
		"CHECK":             true,
		"COLLATE":           true,
		"COLUMN":            true,
		"COLUMNS":           true,
		"COMMIT":            true,
		"COMPACT":           true,
		"CONDITIONAL":       true,
		"CONFLICT":          true,
		"CONSTRAINT":        true,
		"COVER":             true,
		"CREATE":            true,
		"CROSS":             true,
		"CUBE":              true,
		"CURRENT":           true,
		"CURRENT_TIME":      true,
		"CURRENT_DATE":      true,
		"CURRENT_TIMESTAMP": true,
		"DATABASE":          true,
		"DECIMAL":           true,
		"DECLARE":           true,
		"DEFAULT":           true,
		"DEFERRABLE":        true,
		"DEFERRED":          true,
		"DEFINE":            true,
		"DELETE":            true,
		"DESC":              true,
		"DETACH":            true,
		"DICT":              true,
		"DISABLE":           true,
		"DISCARD":           true,
		"DISTINCT":          true,
		"DO":                true,
		"DROP":              true,
		"EACH":              true,
		"ELSE":              true,
		"ERROR":             true,
		"EMPTY":             true,
		"EMPTY_ACTION":      true,
		"ENCRYPTED":         true,
		"END":               true,
		"ENUM":              true,
		"ERASE":             true,
		"ESCAPE":            true,
		"EVALUATE":          true,
		"EXCEPT":            true,
		"EXCLUDE":           true,
		"EXCLUSIVE":         true,
		"EXCLUSION":         true,
		"EXISTS":            true,
		"EXPLAIN":           true,
		"EXPORT":            true,
		"EXTERNAL":          true,
		"FAIL":              true,
		"FAMILY":            true,
		"FILTER":            true,
		"FLATTEN":           true,
		"FLOW":              true,
		"FOLLOWING":         true,
		"FOR":               true,
		"FOREIGN":           true,
		"FROM":              true,
		"FULL":              true,
		"FUNCTION":          true,
		"GLOB":              true,
		"GLOBAL":            true,
		"GROUP":             true,
		"GROUPING":          true,
		"GROUPS":            true,
		"HASH":              true,
		"HAVING":            true,
		"HOP":               true,
		"IF":                true,
		"IGNORE":            true,
		"ILIKE":             true,
		"IMMEDIATE":         true,
		"IMPORT":            true,
		"IN":                true,
		"INDEX":             true,
		"INDEXED":           true,
		"INHERITS":          true,
		"INITIALLY":         true,
		"INNER":             true,
		"INSERT":            true,
		"INSTEAD":           true,
		"INTERSECT":         true,
		"INTO":              true,
		"IS":                true,
		"ISNULL":            true,
		"JOIN":              true,
		"JSON_EXISTS":       true,
		"JSON_VALUE":        true,
		"JSON_QUERY":        true,
		"KEY":               true,
		"LEFT":              true,
		"LIKE":              true,
		"LIMIT":             true,
		"LIST":              true,
		"LOCAL":             true,
		"MATCH":             true,
		"NATURAL":           true,
		"NO":                true,
		"NOT":               true,
		"NOTNULL":           true,
		"NULL":              true,
		"NULLS":             true,
		"OBJECT":            true,
		"OF":                true,
		"OFFSET":            true,
		"ON":                true,
		"ONLY":              true,
		"OPTIONAL":          true,
		"OR":                true,
		"ORDER":             true,
		"OTHERS":            true,
		"OUTER":             true,
		"OVER":              true,
		"PARTITION":         true,
		"PASSING":           true,
		"PASSWORD":          true,
		"PLAN":              true,
		"PRAGMA":            true,
		"PRECEDING":         true,
		"PRESORT":           true,
		"PRIMARY":           true,
		"PROCESS":           true,
		"RAISE":             true,
		"RANGE":             true,
		"REDUCE":            true,
		"REFERENCES":        true,
		"REGEXP":            true,
		"REINDEX":           true,
		"RELEASE":           true,
		"RENAME":            true,
		"REPEATABLE":        true,
		"REPLACE":           true,
		"RESET":             true,
		"RESOURCE":          true,
		"RESPECT":           true,
		"RESTRICT":          true,
		"RESULT":            true,
		"RETURN":            true,
		"RETURNING":         true,
		"REVERT":            true,
		"RIGHT":             true,
		"RLIKE":             true,
		"ROLLBACK":          true,
		"ROLLUP":            true,
		"ROW":               true,
		"ROWS":              true,
		"SAMPLE":            true,
		"SAVEPOINT":         true,
		"SCHEMA":            true,
		"SELECT":            true,
		"SEMI":              true,
		"SET":               true,
		"SETS":              true,
		"STREAM":            true,
		"STRUCT":            true,
		"SUBQUERY":          true,
		"SYMBOLS":           true,
		"SYNC":              true,
		"SYSTEM":            true,
		"TABLE":             true,
		"TABLESAMPLE":       true,
		"TABLESTORE":        true,
		"TAGGED":            true,
		"TEMP":              true,
		"TEMPORARY":         true,
		"THEN":              true,
		"TIES":              true,
		"TO":                true,
		"TRANSACTION":       true,
		"TRIGGER":           true,
		"TUPLE":             true,
		"UNBOUNDED":         true,
		"UNCONDITIONAL":     true,
		"UNION":             true,
		"UNIQUE":            true,
		"UNKNOWN":           true,
		"UPDATE":            true,
		"UPSERT":            true,
		"USE":               true,
		"USER":              true,
		"USING":             true,
		"VACUUM":            true,
		"VALUES":            true,
		"VARIANT":           true,
		"VIEW":              true,
		"VIRTUAL":           true,
		"WHEN":              true,
		"WHERE":             true,
		"WINDOW":            true,
		"WITH":              true,
		"WITHOUT":           true,
		"WRAPPER":           true,
		"XOR":               true,
		"TRUE":              true,
		"FALSE":             true,
	}

	// ydbQuoter = core.Quoter{
	// 	Prefix:     '`',
	// 	Suffix:     '`',
	// 	IsReserved: core.AlwaysReserve,
	// }
)

const (
	// numeric types
	yql_Bool = "BOOL"

	yql_Int8  = "INT8"
	yql_Int16 = "INT16"
	yql_Int32 = "INT32"
	yql_Int64 = "INT64"

	yql_Uint8  = "UINT8"
	yql_Uint16 = "UINT16"
	yql_Uint32 = "UINT32"
	yql_Uint64 = "UINT64"

	yql_Float   = "FLOAT"
	yql_Double  = "DOUBLE"
	yql_Decimal = "DECIMAL"

	// serial types
	yql_Serial    = "SERIAL"
	yql_BigSerial = "BIGSERIAL"

	// string types
	yql_String       = "STRING"
	yql_Utf8         = "UTF8"
	yql_Json         = "JSON"
	yql_JsonDocument = "JSONDOCUMENT"
	yql_Yson         = "YSON"

	// Data and Time
	yql_Date      = "DATE"
	yql_DateTime  = "DATETIME"
	yql_Timestamp = "TIMESTAMP"
	yql_Interval  = "INTERVAL"

	// Containers
	yql_List = "LIST"
)

func toYQLDataType(t string, isAutoIncrement bool) string {
	switch t {
	case core.Bool, core.Boolean:
		return yql_Bool
	case core.TinyInt:
		return yql_Int8
	case core.SmallInt, core.MediumInt, core.Int, core.Integer, core.BigInt:
		// 	if isAutoIncrement {
		// 		return yql_Serial
		// 	}
		// 	return yql_Int32
		// case core.BigInt:
		if isAutoIncrement {
			return yql_BigSerial
		}
		return yql_Int64
	case core.Float:
		return yql_Float
	case core.Double:
		return yql_Double
	case core.Blob, core.LongBlob, core.MediumBlob, core.TinyBlob, core.VarBinary, core.Binary:
		return yql_String
	case core.Json:
		return yql_Json
	case core.Varchar, core.NVarchar, core.Char, core.NChar,
		core.MediumText, core.LongText, core.Text, core.NText, core.TinyText:
		return yql_Utf8
	case core.TimeStamp, core.Time, core.Date, core.DateTime:
		return yql_Timestamp
	case core.Serial:
		return yql_Serial
	case core.BigSerial:
		return yql_BigSerial
	default:
		return t
	}
}

func yqlToSQLType(yqlType string) core.SQLType {
	switch yqlType {
	case yql_Bool:
		return core.SQLType{Name: core.Bool, DefaultLength: 0, DefaultLength2: 0}
	case yql_Int8:
		return core.SQLType{Name: core.TinyInt, DefaultLength: 0, DefaultLength2: 0}
	case yql_Int16:
		return core.SQLType{Name: core.SmallInt, DefaultLength: 0, DefaultLength2: 0}
	case yql_Int32:
		return core.SQLType{Name: core.MediumInt, DefaultLength: 0, DefaultLength2: 0}
	case yql_Int64:
		return core.SQLType{Name: core.BigInt, DefaultLength: 0, DefaultLength2: 0}
	case yql_Float:
		return core.SQLType{Name: core.Float, DefaultLength: 0, DefaultLength2: 0}
	case yql_Double:
		return core.SQLType{Name: core.Double, DefaultLength: 0, DefaultLength2: 0}
	case yql_String:
		return core.SQLType{Name: core.Blob, DefaultLength: 0, DefaultLength2: 0}
	case yql_Json:
		return core.SQLType{Name: core.Json, DefaultLength: 0, DefaultLength2: 0}
	case yql_Utf8:
		return core.SQLType{Name: core.Varchar, DefaultLength: 255, DefaultLength2: 0}
	case yql_Timestamp:
		return core.SQLType{Name: core.TimeStamp, DefaultLength: 0, DefaultLength2: 0}
	default:
		return core.SQLType{Name: yqlType}
	}
}

func removeOptional(s string) string {
	if s = strings.ToUpper(s); strings.HasPrefix(s, "OPTIONAL") {
		s = strings.TrimPrefix(s, "OPTIONAL<")
		s = strings.TrimSuffix(s, ">")
	}
	return s
}

type ydbDialect struct {
	core.Base

	tableParams  map[string]string // TODO: maybe remove
	nativeDriver *ydb.Driver
}

// ydbConnectorWrapper wraps the base YDB connector to handle RowsAffected() without errors
type ydbConnectorWrapper struct {
	base driver.Connector
	db   *ydb.Driver
}

func (w *ydbConnectorWrapper) Connect(ctx context.Context) (driver.Conn, error) {
	conn, err := w.base.Connect(ctx)
	if err != nil {
		return nil, err
	}

	cc := conn.(connTx)
	return &ydbConnWrapper{base: cc}, nil
}

func (w *ydbConnectorWrapper) Driver() driver.Driver {
	return w.base.Driver()
}

func (w *ydbConnectorWrapper) Close() error {
	if w.db != nil {
		return w.db.Close(context.Background())
	}
	return nil
}

type connTx interface {
	driver.Conn
	driver.ConnBeginTx
	driver.ConnPrepareContext
	driver.ConnPrepareContext
}

// ydbConnWrapper wraps the base connection to handle RowsAffected() without errors
type ydbConnWrapper struct {
	base connTx
}

func (w *ydbConnWrapper) Prepare(query string) (driver.Stmt, error) {
	panic("prepare")
}

func (w *ydbConnWrapper) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	return w.base.PrepareContext(ctx, query)
}

func (w *ydbConnWrapper) Close() error {
	return w.base.Close()
}

func (w *ydbConnWrapper) Begin() (driver.Tx, error) {
	return w.base.Begin()
}

func (w *ydbConnWrapper) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	return w.base.BeginTx(ctx, opts)
}

type stmtCtx interface {
	driver.StmtExecContext
	driver.StmtQueryContext
	driver.Stmt
}

// ydbStmtWrapper wraps the base statement to handle RowsAffected() without errors
type ydbStmtWrapper struct {
	base stmtCtx
}

func (w *ydbStmtWrapper) Close() error {
	return w.base.Close()
}

func (w *ydbStmtWrapper) NumInput() int {
	return w.base.NumInput()
}

func (w *ydbStmtWrapper) Exec(args []driver.Value) (driver.Result, error) {
	panic("Exec")
}

func (w *ydbStmtWrapper) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	result, err := w.base.ExecContext(ctx, args)
	if err != nil {
		return nil, err
	}
	return &ydbResultWrapper{base: result}, nil
}

func (w *ydbStmtWrapper) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	return w.base.QueryContext(ctx, args)
}

func (w *ydbStmtWrapper) Query(args []driver.Value) (driver.Rows, error) {
	panic("query")
}

// ydbResultWrapper wraps the base result to handle RowsAffected() without errors
type ydbResultWrapper struct {
	base driver.Result
}

func (w *ydbResultWrapper) LastInsertId() (int64, error) {
	return 0, nil
}

func (w *ydbResultWrapper) RowsAffected() (int64, error) {
	// Always return 0 without error for YDB compatibility
	return 0, nil
}

func (db *ydbDialect) Init(d *core.DB, uri *core.Uri, drivername, dataSourceName string) error {
	ydbDriver, err := ydb.Open(context.Background(), dataSourceName)
	if err != nil {
		return fmt.Errorf("failed to connect by data source name '%s': %w", dataSourceName, err)
	}

	baseConnector, err := ydb.Connector(ydbDriver,
		ydb.WithQueryService(true),
		ydb.WithFakeTx(ydb.QueryExecuteQueryMode),
		ydb.WithNumericArgs(),
		ydb.WithAutoDeclare(),
	)
	if err != nil {
		_ = ydbDriver.Close(context.Background())
		return err
	}

	connector := &ydbConnectorWrapper{
		base: baseConnector,
		db:   ydbDriver,
	}

	sqldb := sql.OpenDB(connector)
	d.DB = sqldb

	return db.Base.Init(core.FromDB(sqldb), db, uri, drivername, dataSourceName)
}

func (db *ydbDialect) IndexCheckSql(tableName, idxName string) (string, []interface{}) {
	return "SELECT Path FROM `.sys/partition_stats` where Path LIKE '%/'" +
		" || $1 || '/' || $2 || '/indexImplTable'", []any{tableName, indexName}
}

func (db *ydbDialect) SupportInsertMany() bool {
	return true // TODO:
}

func (db *ydbDialect) SupportCharset() bool {
	return false // TODO:
}

func (db *ydbDialect) SupportEngine() bool {
	return false // TODO:
}

func (db *ydbDialect) WithConn(ctx context.Context, f func(context.Context, *sql.Conn) error) error {
	cc, err := db.DB().Conn(ctx)
	if err != nil {
		return err
	}
	defer cc.Close()

	return f(ctx, cc)
}

func (db *ydbDialect) WithConnRaw(ctx context.Context, f func(d interface{}) error) error {
	return db.WithConn(ctx, func(ctx context.Context, cc *sql.Conn) error {
		return cc.Raw(f)
	})
}

func (db *ydbDialect) SetParams(tableParams map[string]string) {
	db.tableParams = tableParams
}

func (db *ydbDialect) IsTableExist(
	ctx context.Context,
	tableName string) (_ bool, err error) {
	var exists bool
	err = db.WithConnRaw(ctx, func(dc interface{}) error {
		q, ok := dc.(interface {
			IsTableExists(context.Context, string) (bool, error)
		})
		if !ok {
			return fmt.Errorf("driver does not support query metadata")
		}
		exists, err = q.IsTableExists(ctx, tableName)
		if err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return false, err
	}
	return exists, nil
}

func (db *ydbDialect) TableCheckSql(tableName string) (string, []any) {
	return "SELECT Path FROM `.sys/partition_stats` where Path LIKE '%/' || $1", []any{tableName}
}

// func (db *ydb) Features() *core.DialectFeatures {
// 	return &DialectFeatures{
// 		AutoincrMode: -1,
// 	}
// }

// unsupported feature
// func (db *ydb) IsSequenceExist(_ context.Context, _ core.Queryer, _ string) (bool, error) {
// 	return false, nil
// }

func (db *ydbDialect) AutoIncrStr() string {
	return ""
}

func (db *ydbDialect) IsReserved(name string) bool {
	_, ok := ydbReservedWords[strings.ToUpper(name)]
	return ok
}

// func (db *ydb) SetQuotePolicy(quotePolicy QuotePolicy) {
// 	switch quotePolicy {
// 	case QuotePolicyNone:
// 		q := ydbQuoter
// 		q.IsReserved = core.AlwaysNoReserve
// 		db.quoter = q
// 	case QuotePolicyReserved:
// 		q := ydbQuoter
// 		q.IsReserved = db.IsReserved
// 		db.quoter = q
// 	case QuotePolicyAlways:
// 		fallthrough
// 	default:
// 		db.quoter = ydbQuoter
// 	}
// }

func (db *ydbDialect) SqlType(column *core.Column) string {
	return toYQLDataType(column.SQLType.Name, column.IsAutoIncrement)
}

// https://pkg.go.dev/database/sql#ColumnType.DatabaseTypeName
func (db *ydbDialect) ColumnTypeKind(t string) int {
	switch t {
	// case "BOOL":
	// 	return core.BOOL_TYPE
	case "INT8", "INT16", "INT32", "INT64", "UINT8", "UINT16", "UINT32", "UINT64":
		return core.NUMERIC_TYPE
	case "UTF8":
		return core.TEXT_TYPE
	case "TIMESTAMP":
		return core.TIME_TYPE
	default:
		return core.UNKNOW_TYPE
	}
}

// func (db *ydb) Version(ctx context.Context, queryer core.Queryer) (_ *core.Version, err error) {
// 	var version string
// 	err = db.WithConnRaw(queryer, ctx, func(dc interface{}) error {
// 		q, ok := dc.(interface {
// 			Version(ctx context.Context) (string, error)
// 		})
// 		if !ok {
// 			return fmt.Errorf("driver does not support query metadata")
// 		}
// 		version, err = q.Version(ctx)
// 		if err != nil {
// 			return err
// 		}
// 		return nil
// 	})
// 	if err != nil {
// 		return nil, err
// 	}

// 	return &core.Version{
// 		Edition: version,
// 	}, nil
// }

// func (db *ydb) IsTableExist(
// 	queryer core.Queryer,
// 	ctx context.Context,
// 	tableName string) (_ bool, err error) {
// 	var exists bool
// 	err = db.WithConnRaw(queryer, ctx, func(dc interface{}) error {
// 		q, ok := dc.(interface {
// 			IsTableExists(context.Context, string) (bool, error)
// 		})
// 		if !ok {
// 			return fmt.Errorf("driver does not support query metadata")
// 		}
// 		exists, err = q.IsTableExists(ctx, tableName)
// 		if err != nil {
// 			return err
// 		}
// 		return nil
// 	})

// 	if err != nil {
// 		return false, err
// 	}
// 	return exists, nil
// }

func (db *ydbDialect) Quote(name string) string {
	return "`" + name + "`" // TODO:
}

func (db *ydbDialect) AddColumnSQL(tableName string, col *core.Column) string {
	tableName = db.Quote(tableName)
	columnName := db.Quote(col.Name)
	dataType := db.SqlType(col)

	var buf strings.Builder
	buf.WriteString(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s;", tableName, columnName, dataType))

	return buf.String()
}

// YDB does not support this operation
func (db *ydbDialect) ModifyColumnSQL(tableName string, column *core.Column) string {
	return ""
}

// SYNC by default
// func (db *ydb) CreateIndexSQL(tableName string, index *core.Index) string {
// 	tableName = db.Quote(tableName)
// 	indexName := db.Quote(index.Name)

// 	colsIndex := make([]string, len(index.Cols))
// 	for i := 0; i < len(index.Cols); i++ {
// 		colsIndex[i] = db.Quote(index.Cols[i])
// 	}

// 	indexOn := strings.Join(colsIndex, ",")

// 	var buf strings.Builder
// 	buf.WriteString(fmt.Sprintf("ALTER TABLE %s ADD INDEX %s GLOBAL ON ( %s );", tableName, indexName, indexOn))

// 	return buf.String()
// }

func (db *ydbDialect) DropIndexSql(tableName string, index *core.Index) string {
	tableName = db.Quote(tableName)
	indexName := db.Quote(index.Name)

	var buf strings.Builder
	buf.WriteString(fmt.Sprintf("ALTER TABLE %s DROP INDEX %s;", tableName, indexName))

	return buf.String()
}

func (db *ydbDialect) IndexOnTable() bool {
	return true // TODO:
}

// TODO:
func (db *ydbDialect) IsColumnExist(
	tableName,
	columnName string) (_ bool, err error) {
	var exists bool
	ctx := context.TODO()
	err = db.WithConnRaw(ctx, func(dc interface{}) error {
		q, ok := dc.(interface {
			IsColumnExists(context.Context, string, string) (bool, error)
		})
		if !ok {
			return fmt.Errorf("driver does not support query metadata")
		}
		exists, err = q.IsColumnExists(ctx, tableName, columnName)
		if err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return false, err
	}
	return exists, nil
}

// TODO:
func (db *ydbDialect) GetColumns(tableName string) (
	_ []string,
	_ map[string]*core.Column,
	err error) {

	ctx := context.TODO()
	// dbName := db.nativeDriver.Scheme().Database()
	// tablePath := dbName + "/" + tableName

	// var desc options.Description

	// db.nativeDriver.Table().Do(ctx, func(ctx context.Context, s table.Session) error {
	// 	desc, err = s.DescribeTable(ctx, tablePath)
	// 	return err
	// })

	// colNames := make([]string, len(desc.Columns))
	// for i, col := range desc.Columns {
	// 	colNames[i] = col.Name
	// }

	colNames := make([]string, 0)
	colMaps := make(map[string]*core.Column)

	// db.nativeDriver

	err = db.WithConnRaw(ctx, func(dc interface{}) error {
		q, ok := dc.(interface {
			GetColumns(context.Context, string) ([]string, error)
			GetColumnType(context.Context, string, string) (string, error)
			IsPrimaryKey(context.Context, string, string) (bool, error)
		})
		if !ok {
			return fmt.Errorf("driver does not support query metadata")
		}

		colNames, err = q.GetColumns(ctx, tableName)
		if err != nil {
			return err
		}

		for _, colName := range colNames {
			dataType, err := q.GetColumnType(ctx, tableName, colName)
			if err != nil {
				return err
			}
			dataType = removeOptional(dataType)
			isPK, err := q.IsPrimaryKey(ctx, tableName, colName)
			if err != nil {
				return err
			}
			col := &core.Column{
				Name:         colName,
				TableName:    tableName,
				SQLType:      yqlToSQLType(dataType),
				IsPrimaryKey: isPK,
				Nullable:     !isPK,
				Indexes:      make(map[string]int),
			}
			if dataType == "SERIAL" || dataType == "BIGSERIAL" {
				col.IsAutoIncrement = true
			}
			colMaps[colName] = col
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	return colNames, colMaps, nil
}

func (db *ydbDialect) GetTables() (_ []*core.Table, err error) {
	tables := make([]*core.Table, 0)
	ctx := context.TODO()
	err = db.WithConnRaw(ctx, func(dc interface{}) error {
		q, ok := dc.(interface {
			GetTables(context.Context, string, bool, bool) ([]string, error)
		})
		if !ok {
			return fmt.Errorf("driver does not support query metadata")
		}
		tableNames, err := q.GetTables(ctx, ".", true, true)
		if err != nil {
			return err
		}
		for _, tableName := range tableNames {
			table := core.NewEmptyTable()
			table.Name = tableName
			tables = append(tables, table)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return tables, nil
}

func (db *ydbDialect) GetIndexes(tableName string) (_ map[string]*core.Index, err error) {
	panic(tableName)
	indexes := make(map[string]*core.Index, 0)
	ctx := context.TODO()
	err = db.WithConnRaw(ctx, func(dc interface{}) error {
		q, ok := dc.(interface {
			GetIndexes(context.Context, string) ([]string, error)
			GetIndexColumns(context.Context, string, string) ([]string, error)
		})
		if !ok {
			return fmt.Errorf("driver does not support query metadata")
		}
		indexNames, err := q.GetIndexes(ctx, tableName)
		if err != nil {
			return err
		}
		for _, indexName := range indexNames {
			cols, err := q.GetIndexColumns(ctx, tableName, indexName)
			if err != nil {
				return err
			}
			indexes[indexName] = &core.Index{
				Name: indexName,
				Type: core.IndexType,
				Cols: cols,
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return indexes, nil
}

// !datbeohbbh! CreateTableSQL generate `CREATE TABLE` YQL.
// Method does not generate YQL for creating index.
func (db *ydbDialect) CreateTableSQL(
	ctx context.Context,
	_ any,
	table *core.Table,
	tableName string) (string, bool, error) {
	tableName = db.Quote(tableName)

	var buf strings.Builder
	buf.WriteString(fmt.Sprintf("CREATE TABLE %s ( ", tableName))

	// 	build primary key
	if len(table.PrimaryKeys) == 0 {
		return "", false, errors.New("table must have at least one primary key")
	}
	pk := make([]string, len(table.PrimaryKeys))
	pkMap := make(map[string]bool)
	for i := 0; i < len(table.PrimaryKeys); i++ {
		pk[i] = db.Quote(table.PrimaryKeys[i])
		pkMap[pk[i]] = true
	}
	primaryKey := fmt.Sprintf("PRIMARY KEY ( %s )", strings.Join(pk, ", "))

	// build column
	columnsList := []string{}
	for _, c := range table.Columns() {
		columnName := db.Quote(c.Name)
		dataType := db.SqlType(c)

		if _, isPk := pkMap[columnName]; isPk {
			columnsList = append(columnsList, fmt.Sprintf("%s %s NOT NULL", columnName, dataType))
		} else {
			columnsList = append(columnsList, fmt.Sprintf("%s %s", columnName, dataType))
		}
	}
	joinColumns := strings.Join(columnsList, ", ")

	buf.WriteString(strings.Join([]string{joinColumns, primaryKey}, ", "))
	buf.WriteString(" ) ")

	if db.tableParams != nil && len(db.tableParams) > 0 {
		params := make([]string, 0)
		for param, value := range db.tableParams {
			if param == "" || value == "" {
				continue
			}
			params = append(params, fmt.Sprintf("%s = %s", param, value))
		}
		if len(params) > 0 {
			buf.WriteString(fmt.Sprintf("WITH ( %s ) ", strings.Join(params, ", ")))
		}
	}

	buf.WriteString("; ")

	return buf.String(), true, nil
}

func (db *ydbDialect) DropTableSQL(tableName string) (string, bool) {
	tableName = db.Quote(tableName)

	var buf strings.Builder
	buf.WriteString(fmt.Sprintf("DROP TABLE %s;", tableName))

	return buf.String(), false
}

type ydbSeqFilter struct {
	Prefix string
	Start  int
}

// func ydbSeqFilterConvertQuestionMark(sql, prefix string, start int) string {
// 	var buf strings.Builder
// 	var beginSingleQuote bool
// 	var isLineComment bool
// 	var isComment bool
// 	var isMaybeLineComment bool
// 	var isMaybeComment bool
// 	var isMaybeCommentEnd bool
// 	index := start
// 	for _, c := range sql {
// 		if !beginSingleQuote && !isLineComment && !isComment && c == '?' {
// 			buf.WriteString(prefix)
// 			buf.WriteString(strconv.Itoa(index))
// 			index++
// 		} else {
// 			if isMaybeLineComment {
// 				if c == '-' {
// 					isLineComment = true
// 				}
// 				isMaybeLineComment = false
// 			} else if isMaybeComment {
// 				if c == '*' {
// 					isComment = true
// 				}
// 				isMaybeComment = false
// 			} else if isMaybeCommentEnd {
// 				if c == '/' {
// 					isComment = false
// 				}
// 				isMaybeCommentEnd = false
// 			} else if isLineComment {
// 				if c == '\n' {
// 					isLineComment = false
// 				}
// 			} else if isComment {
// 				if c == '*' {
// 					isMaybeCommentEnd = true
// 				}
// 			} else if !beginSingleQuote && c == '-' {
// 				isMaybeLineComment = true
// 			} else if !beginSingleQuote && c == '/' {
// 				isMaybeComment = true
// 			} else if c == '\'' {
// 				beginSingleQuote = !beginSingleQuote
// 			}
// 			buf.WriteRune(c)
// 		}
// 	}
// 	return buf.String()
// }

// Do implements Filter
// func (s *ydbSeqFilter) Do(ctx context.Context, sql string) string {
// 	return ydbSeqFilterConvertQuestionMark(sql, s.Prefix, s.Start)
// }

// https://github.com/ydb-platform/ydb-go-sdk/blob/master/SQL.md#specifying-query-parameters-
//
//	func (db *ydb) Filters() []core.Filter {
//		return []core.Filter{&ydbSeqFilter{
//			Prefix: "$",
//			Start:  1,
//		}}
//	}
//
// TODO:
func (db *ydbDialect) Filters() []core.Filter {
	return []core.Filter{&core.IdFilter{}, &core.SeqFilter{Prefix: "$", Start: 1}}
}

const (
	ydb_grpc_Canceled           uint32 = 1
	ydb_grpc_Unknown            uint32 = 2
	ydb_grpc_InvalidArgument    uint32 = 3
	ydb_grpc_DeadlineExceeded   uint32 = 4
	ydb_grpc_NotFound           uint32 = 5
	ydb_grpc_AlreadyExists      uint32 = 6
	ydb_grpc_PermissionDenied   uint32 = 7
	ydb_grpc_ResourceExhausted  uint32 = 8
	ydb_grpc_FailedPrecondition uint32 = 9
	ydb_grpc_Aborted            uint32 = 10
	ydb_grpc_OutOfRange         uint32 = 11
	ydb_grpc_Unimplemented      uint32 = 12
	ydb_grpc_Internal           uint32 = 13
	ydb_grpc_Unavailable        uint32 = 14
	ydb_grpc_DataLoss           uint32 = 15
	ydb_grpc_Unauthenticated    uint32 = 16
)

const (
	ydb_STATUS_CODE_UNSPECIFIED int32 = 0
	ydb_SUCCESS                 int32 = 400000
	ydb_BAD_REQUEST             int32 = 400010
	ydb_UNAUTHORIZED            int32 = 400020
	ydb_INTERNAL_ERROR          int32 = 400030
	ydb_ABORTED                 int32 = 400040
	ydb_UNAVAILABLE             int32 = 400050
	ydb_OVERLOADED              int32 = 400060
	ydb_SCHEME_ERROR            int32 = 400070
	ydb_GENERIC_ERROR           int32 = 400080
	ydb_TIMEOUT                 int32 = 400090
	ydb_BAD_SESSION             int32 = 400100
	ydb_PRECONDITION_FAILED     int32 = 400120
	ydb_ALREADY_EXISTS          int32 = 400130
	ydb_NOT_FOUND               int32 = 400140
	ydb_SESSION_EXPIRED         int32 = 400150
	ydb_CANCELLED               int32 = 400160
	ydb_UNDETERMINED            int32 = 400170
	ydb_UNSUPPORTED             int32 = 400180
	ydb_SESSION_BUSY            int32 = 400190
)

// https://github.com/ydb-platform/ydb-go-sdk/blob/ca13feb3ca560ac7385e79d4365ffe0cd8c23e21/errors.go#L27
func (db *ydbDialect) IsRetryable(err error) bool {
	var target interface {
		error
		Code() int32
		Name() string
	}
	if errors.Is(err, fmt.Errorf("unknown error")) ||
		errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, context.Canceled) {
		return false
	}
	if !errors.As(err, &target) {
		return false
	}

	switch target.Code() {
	case
		int32(ydb_grpc_Unknown),
		int32(ydb_grpc_InvalidArgument),
		int32(ydb_grpc_DeadlineExceeded),
		int32(ydb_grpc_NotFound),
		int32(ydb_grpc_AlreadyExists),
		int32(ydb_grpc_PermissionDenied),
		int32(ydb_grpc_FailedPrecondition),
		int32(ydb_grpc_OutOfRange),
		int32(ydb_grpc_Unimplemented),
		int32(ydb_grpc_DataLoss),
		int32(ydb_grpc_Unauthenticated):
		return false
	case
		int32(ydb_grpc_Canceled),
		int32(ydb_grpc_ResourceExhausted),
		int32(ydb_grpc_Aborted),
		int32(ydb_grpc_Internal),
		int32(ydb_grpc_Unavailable):
		return true
	case
		ydb_STATUS_CODE_UNSPECIFIED,
		ydb_BAD_REQUEST,
		ydb_UNAUTHORIZED,
		ydb_INTERNAL_ERROR,
		ydb_SCHEME_ERROR,
		ydb_GENERIC_ERROR,
		ydb_TIMEOUT,
		ydb_PRECONDITION_FAILED,
		ydb_ALREADY_EXISTS,
		ydb_NOT_FOUND,
		ydb_SESSION_EXPIRED,
		ydb_CANCELLED,
		ydb_UNSUPPORTED:
		return false
	case
		ydb_ABORTED,
		ydb_UNAVAILABLE,
		ydb_OVERLOADED,
		ydb_BAD_SESSION,
		ydb_UNDETERMINED,
		ydb_SESSION_BUSY:
		return true
	default:
		return false
	}
}

type ydbDriver struct {
	core.Base
}

// func (ydbDrv *ydbDriver) Features() *DriverFeatures {
// 	return &DriverFeatures{
// 		SupportReturnInsertedID: false,
// 	}
// }

// DSN format: https://github.com/ydb-platform/ydb-go-sdk/blob/a804c31be0d3c44dfd7b21ed49d863619217b11d/connection.go#L339
func (ydbDrv *ydbDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	info := &core.Uri{DbType: core.YDB}

	uri, err := url.Parse(dataSourceName)
	if err != nil {
		return nil, fmt.Errorf("failed on parse data source %v", dataSourceName)
	}

	const (
		secure   = "grpcs"
		insecure = "grpc"
	)

	if uri.Scheme != secure && uri.Scheme != insecure {
		return nil, fmt.Errorf("unsupported scheme %v", uri.Scheme)
	}

	info.Host = uri.Host
	if spl := strings.Split(uri.Host, ":"); len(spl) > 1 {
		info.Host = spl[0]
		info.Port = spl[1]
	}

	info.DbName = uri.Path
	if info.DbName == "" {
		return nil, errors.New("database path can not be empty")
	}

	if uri.User != nil {
		info.Passwd, _ = uri.User.Password()
		info.User = uri.User.Username()
	}

	return info, nil
}

// https://pkg.go.dev/database/sql#ColumnType.DatabaseTypeName
func GenScanResult(columnType string) (interface{}, error) {
	switch columnType = removeOptional(columnType); columnType {
	case yql_Bool:
		var ret sql.NullBool
		return &ret, nil
	case yql_Int16:
		var ret sql.NullInt16
		return &ret, nil
	case yql_Int32:
		var ret sql.NullInt32
		return &ret, nil
	case yql_Int64:
		var ret sql.NullInt64
		return &ret, nil
	case yql_Uint8:
		var ret sql.NullByte
		return &ret, nil
	case yql_Double:
		var ret sql.NullFloat64
		return &ret, nil
	case yql_Utf8:
		var ret sql.NullString
		return &ret, nil
	case yql_Timestamp:
		var ret sql.NullTime
		return &ret, nil
	default:
		var ret sql.RawBytes
		return &ret, nil
	}
}

// func (ydbDrv *ydbDriver) Scan(ctx *Scan, rows *core.Rows, types []*sql.ColumnType, v ...interface{}) error {
// 	if err := rows.Scan(v...); err != nil {
// 		return err
// 	}

// 	if ctx.UserLocation == nil {
// 		return nil
// 	}

// 	for i := range v {
// 		// !datbeohbbh! YDB saves time in UTC. When returned value is time type, then value will be represented in local time.
// 		// So value in time type must be converted to UserLocation.
// 		switch des := v[i].(type) {
// 		case *time.Time:
// 			*des = (*des).In(ctx.UserLocation)
// 		case *sql.NullTime:
// 			if des.Valid {
// 				(*des).Time = (*des).Time.In(ctx.UserLocation)
// 			}
// 		case *interface{}:
// 			switch t := (*des).(type) {
// 			case time.Time:
// 				*des = t.In(ctx.UserLocation)
// 			case sql.NullTime:
// 				if t.Valid {
// 					*des = t.Time.In(ctx.UserLocation)
// 				}
// 			}
// 		}
// 	}

// 	return nil
// }
