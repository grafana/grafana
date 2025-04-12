// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Conversion is an interface. A type implements Conversion will according
// the custom method to fill into database and retrieve from database.
type coreConversion interface {
	FromDB([]byte) error
	ToDB() ([]byte, error)
}

type Driver interface {
	Parse(string, string) (*coreUri, error)
}
type corePK []any

// // DB is a wrap of sql.DB with extra contents
type coreDB struct{ *sql.DB }

// Stmt reprents a stmt objects
type coreStmt struct {
	*sql.Stmt
	db    *coreDB
	names map[string]int
}

type coreTx struct {
	*sql.Tx
	db *coreDB
}

var drivers = map[string]Driver{}
var re = regexp.MustCompile(`[?](\w+)`)

func RegisterDriver(driverName string, driver Driver) {
	if driver == nil {
		panic("core: Register driver is nil")
	}
	if _, dup := drivers[driverName]; dup {
		panic("core: Register called twice for driver " + driverName)
	}
	drivers[driverName] = driver
}

func QueryDriver(driverName string) Driver {
	return drivers[driverName]
}

// Open opens a database
func Open(driverName, dataSourceName string) (*coreDB, error) {
	db, err := sql.Open(driverName, dataSourceName)
	if err != nil {
		return nil, err
	}
	return &coreDB{DB: db}, nil
}

func (db *coreDB) PrepareContext(ctx context.Context, query string) (*coreStmt, error) {
	names := make(map[string]int)
	var i int
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		names[src[1:]] = i
		i += 1
		return "?"
	})

	stmt, err := db.DB.PrepareContext(ctx, query)
	if err != nil {
		return nil, err
	}
	return &coreStmt{stmt, db, names}, nil
}

// QueryContext overwrites sql.DB.QueryContext
func (db *coreDB) QueryContext(ctx context.Context, query string, args ...interface{}) (*coreRows, error) {
	rows, err := db.DB.QueryContext(ctx, query, args...)
	if err != nil {
		if rows != nil {
			rows.Close()
		}
		return nil, err
	}
	return &coreRows{rows, db}, nil
}

func (s *coreStmt) QueryContext(ctx context.Context, args ...interface{}) (*coreRows, error) {
	rows, err := s.Stmt.QueryContext(ctx, args...)
	if err != nil {
		return nil, err
	}
	return &coreRows{rows, s.db}, nil
}

func (db *coreDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (*coreTx, error) {
	tx, err := db.DB.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &coreTx{tx, db}, nil
}

func (db *coreDB) Begin() (*coreTx, error) {
	tx, err := db.DB.Begin()
	if err != nil {
		return nil, err
	}
	return &coreTx{tx, db}, nil
}

func (tx *coreTx) PrepareContext(ctx context.Context, query string) (*coreStmt, error) {
	names := make(map[string]int)
	var i int
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		names[src[1:]] = i
		i += 1
		return "?"
	})

	stmt, err := tx.Tx.PrepareContext(ctx, query)
	if err != nil {
		return nil, err
	}
	return &coreStmt{stmt, tx.db, names}, nil
}

func (tx *coreTx) Prepare(query string) (*coreStmt, error) {
	return tx.PrepareContext(context.Background(), query)
}

func (tx *coreTx) StmtContext(ctx context.Context, stmt *coreStmt) *coreStmt {
	stmt.Stmt = tx.Tx.StmtContext(ctx, stmt.Stmt)
	return stmt
}

func (tx *coreTx) Stmt(stmt *coreStmt) *coreStmt {
	return tx.StmtContext(context.Background(), stmt)
}

func (tx *coreTx) QueryContext(ctx context.Context, query string, args ...interface{}) (*coreRows, error) {
	rows, err := tx.Tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return &coreRows{rows, tx.db}, nil
}

func (tx *coreTx) Query(query string, args ...interface{}) (*coreRows, error) {
	return tx.QueryContext(context.Background(), query, args...)
}

// Column defines database column
type coreColumn struct {
	Name            string
	TableName       string
	FieldName       string
	SQLType         coreSQLType
	IsJSON          bool
	Length          int
	Length2         int
	Nullable        bool
	Default         string
	Indexes         map[string]int
	IsPrimaryKey    bool
	IsAutoIncrement bool
	IsCreated       bool
	IsUpdated       bool
	IsDeleted       bool
	IsCascade       bool
	IsVersion       bool
	DefaultIsEmpty  bool // false means column has no default set, but not default value is empty
	EnumOptions     map[string]int
	SetOptions      map[string]int
	DisableTimeZone bool
	TimeZone        *time.Location // column specified time zone
	Comment         string
}

// NewColumn creates a new column
func NewColumn(name, fieldName string, sqlType coreSQLType, len1, len2 int, nullable bool) *coreColumn {
	return &coreColumn{
		Name:            name,
		TableName:       "",
		FieldName:       fieldName,
		SQLType:         sqlType,
		Length:          len1,
		Length2:         len2,
		Nullable:        nullable,
		Default:         "",
		Indexes:         make(map[string]int),
		IsPrimaryKey:    false,
		IsAutoIncrement: false,
		IsCreated:       false,
		IsUpdated:       false,
		IsDeleted:       false,
		IsCascade:       false,
		IsVersion:       false,
		DefaultIsEmpty:  true, // default should be no default
		EnumOptions:     make(map[string]int),
		Comment:         "",
	}
}

// String generate column description string according dialect
func (col *coreColumn) String(d coreDialect) string {
	sql := d.Quote(col.Name) + " "

	sql += d.SqlType(col) + " "

	if col.IsPrimaryKey {
		sql += "PRIMARY KEY "
		if col.IsAutoIncrement {
			sql += d.AutoIncrStr() + " "
		}
	}

	if col.Default != "" {
		sql += "DEFAULT " + col.Default + " "
	}

	if d.ShowCreateNull() {
		if col.Nullable {
			sql += "NULL "
		} else {
			sql += "NOT NULL "
		}
	}

	return sql
}

// StringNoPk generate column description string according dialect without primary keys
func (col *coreColumn) StringNoPk(d coreDialect) string {
	sql := d.Quote(col.Name) + " "

	sql += d.SqlType(col) + " "

	if col.Default != "" {
		sql += "DEFAULT " + col.Default + " "
	}

	if d.ShowCreateNull() {
		if col.Nullable {
			sql += "NULL "
		} else {
			sql += "NOT NULL "
		}
	}

	return sql
}

// ValueOf returns column's filed of struct's value
func (col *coreColumn) ValueOf(bean interface{}) (*reflect.Value, error) {
	dataStruct := reflect.Indirect(reflect.ValueOf(bean))
	return col.ValueOfV(&dataStruct)
}

// ValueOfV returns column's filed of struct's value accept reflevt value
func (col *coreColumn) ValueOfV(dataStruct *reflect.Value) (*reflect.Value, error) {
	var fieldValue reflect.Value
	fieldPath := strings.Split(col.FieldName, ".")

	if dataStruct.Type().Kind() == reflect.Map {
		keyValue := reflect.ValueOf(fieldPath[len(fieldPath)-1])
		fieldValue = dataStruct.MapIndex(keyValue)
		return &fieldValue, nil
	} else if dataStruct.Type().Kind() == reflect.Interface {
		structValue := reflect.ValueOf(dataStruct.Interface())
		dataStruct = &structValue
	}

	level := len(fieldPath)
	fieldValue = dataStruct.FieldByName(fieldPath[0])
	for i := 0; i < level-1; i++ {
		if !fieldValue.IsValid() {
			break
		}
		if fieldValue.Kind() == reflect.Struct {
			fieldValue = fieldValue.FieldByName(fieldPath[i+1])
		} else if fieldValue.Kind() == reflect.Ptr {
			if fieldValue.IsNil() {
				fieldValue.Set(reflect.New(fieldValue.Type().Elem()))
			}
			fieldValue = fieldValue.Elem().FieldByName(fieldPath[i+1])
		} else {
			return nil, fmt.Errorf("field %v is not valid", col.FieldName)
		}
	}

	if !fieldValue.IsValid() {
		return nil, fmt.Errorf("field %v is not valid", col.FieldName)
	}

	return &fieldValue, nil
}

type coreDbType string

type coreUri struct {
	DbType  coreDbType
	Proto   string
	Host    string
	Port    string
	DbName  string
	User    string
	Passwd  string
	Charset string
	Laddr   string
	Raddr   string
	Timeout time.Duration
	Schema  string
}

// a dialect is a driver's wrapper
type coreDialect interface {
	SetLogger(logger coreILogger)
	Init(*coreDB, *coreUri, string, string) error
	URI() *coreUri
	DB() *coreDB
	DBType() coreDbType
	SqlType(*coreColumn) string
	FormatBytes(b []byte) string

	DriverName() string
	DataSourceName() string

	IsReserved(string) bool
	Quote(string) string

	AndStr() string
	OrStr() string
	EqStr() string
	RollBackStr() string
	AutoIncrStr() string

	SupportInsertMany() bool
	SupportEngine() bool
	SupportCharset() bool
	SupportDropIfExists() bool
	IndexOnTable() bool
	ShowCreateNull() bool

	IndexCheckSql(tableName, idxName string) (string, []interface{})
	TableCheckSql(tableName string) (string, []interface{})

	IsColumnExist(tableName string, colName string) (bool, error)

	CreateTableSql(table *coreTable, tableName, storeEngine, charset string) string
	DropTableSql(tableName string) string
	CreateIndexSql(tableName string, index *coreIndex) string
	DropIndexSql(tableName string, index *coreIndex) string

	ModifyColumnSql(tableName string, col *coreColumn) string

	ForUpdateSql(query string) string

	// CreateTableIfNotExists(table *Table, tableName, storeEngine, charset string) error
	// MustDropTable(tableName string) error

	GetColumns(tableName string) ([]string, map[string]*coreColumn, error)
	GetTables() ([]*coreTable, error)
	GetIndexes(tableName string) (map[string]*coreIndex, error)

	Filters() []coreFilter
	SetParams(params map[string]string)
}

func OpenDialect(dialect coreDialect) (*coreDB, error) {
	return Open(dialect.DriverName(), dialect.DataSourceName())
}

// Base represents a basic dialect and all real dialects could embed this struct
type coreBase struct {
	db             *coreDB
	dialect        coreDialect
	driverName     string
	dataSourceName string
	logger         coreILogger
	*coreUri
}

func (b *coreBase) DB() *coreDB {
	return b.db
}

func (b *coreBase) SetLogger(logger coreILogger) {
	b.logger = logger
}

func (b *coreBase) Init(db *coreDB, dialect coreDialect, uri *coreUri, drivername, dataSourceName string) error {
	b.db, b.dialect, b.coreUri = db, dialect, uri
	b.driverName, b.dataSourceName = drivername, dataSourceName
	return nil
}

func (b *coreBase) URI() *coreUri {
	return b.coreUri
}

func (b *coreBase) DBType() coreDbType {
	return b.coreUri.DbType
}

func (b *coreBase) FormatBytes(bs []byte) string {
	return fmt.Sprintf("0x%x", bs)
}

func (b *coreBase) DriverName() string {
	return b.driverName
}

func (b *coreBase) ShowCreateNull() bool {
	return true
}

func (b *coreBase) DataSourceName() string {
	return b.dataSourceName
}

func (b *coreBase) AndStr() string {
	return "AND"
}

func (b *coreBase) OrStr() string {
	return "OR"
}

func (b *coreBase) EqStr() string {
	return "="
}

func (db *coreBase) RollBackStr() string {
	return "ROLL BACK"
}

func (db *coreBase) SupportDropIfExists() bool {
	return true
}

func (db *coreBase) DropTableSql(tableName string) string {
	quote := db.dialect.Quote
	return fmt.Sprintf("DROP TABLE IF EXISTS %s", quote(tableName))
}

func (db *coreBase) HasRecords(query string, args ...interface{}) (bool, error) {
	db.LogSQL(query, args)
	rows, err := db.DB().Query(query, args...)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	if rows.Next() {
		return true, nil
	}
	return false, nil
}

func (db *coreBase) IsColumnExist(tableName, colName string) (bool, error) {
	query := fmt.Sprintf(
		"SELECT %v FROM %v.%v WHERE %v = ? AND %v = ? AND %v = ?",
		db.dialect.Quote("COLUMN_NAME"),
		db.dialect.Quote("INFORMATION_SCHEMA"),
		db.dialect.Quote("COLUMNS"),
		db.dialect.Quote("TABLE_SCHEMA"),
		db.dialect.Quote("TABLE_NAME"),
		db.dialect.Quote("COLUMN_NAME"),
	)
	return db.HasRecords(query, db.DbName, tableName, colName)
}

func (db *coreBase) CreateIndexSql(tableName string, index *coreIndex) string {
	quote := db.dialect.Quote
	var unique string
	var idxName string
	if index.Type == UniqueType {
		unique = " UNIQUE"
	}
	idxName = index.XName(tableName)
	return fmt.Sprintf("CREATE%s INDEX %v ON %v (%v)", unique,
		quote(idxName), quote(tableName),
		quote(strings.Join(index.Cols, quote(","))))
}

func (db *coreBase) DropIndexSql(tableName string, index *coreIndex) string {
	quote := db.dialect.Quote
	var name string
	if index.IsRegular {
		name = index.XName(tableName)
	} else {
		name = index.Name
	}
	return fmt.Sprintf("DROP INDEX %v ON %s", quote(name), quote(tableName))
}

func (db *coreBase) ModifyColumnSql(tableName string, col *coreColumn) string {
	return fmt.Sprintf("alter table %s MODIFY COLUMN %s", tableName, col.StringNoPk(db.dialect))
}

func (b *coreBase) CreateTableSql(table *coreTable, tableName, storeEngine, charset string) string {
	var sql string
	sql = "CREATE TABLE IF NOT EXISTS "
	if tableName == "" {
		tableName = table.Name
	}

	sql += b.dialect.Quote(tableName)
	sql += " ("

	if len(table.ColumnsSeq()) > 0 {
		pkList := table.PrimaryKeys

		for _, colName := range table.ColumnsSeq() {
			col := table.GetColumn(colName)
			if col.IsPrimaryKey && len(pkList) == 1 {
				sql += col.String(b.dialect)
			} else {
				sql += col.StringNoPk(b.dialect)
			}
			sql = strings.TrimSpace(sql)
			if b.DriverName() == MYSQL && len(col.Comment) > 0 {
				sql += " COMMENT '" + col.Comment + "'"
			}
			sql += ", "
		}

		if len(pkList) > 1 {
			sql += "PRIMARY KEY ( "
			sql += b.dialect.Quote(strings.Join(pkList, b.dialect.Quote(",")))
			sql += " ), "
		}

		sql = sql[:len(sql)-2]
	}
	sql += ")"

	if b.dialect.SupportEngine() && storeEngine != "" {
		sql += " ENGINE=" + storeEngine
	}
	if b.dialect.SupportCharset() {
		if len(charset) == 0 {
			charset = b.dialect.URI().Charset
		}
		if len(charset) > 0 {
			sql += " DEFAULT CHARSET " + charset
		}
	}

	return sql
}

func (b *coreBase) ForUpdateSql(query string) string {
	return query + " FOR UPDATE"
}

func (b *coreBase) LogSQL(sql string, args []interface{}) {
	if b.logger != nil && b.logger.IsShowSQL() {
		if len(args) > 0 {
			b.logger.Infof("[SQL] %v %v", sql, args)
		} else {
			b.logger.Infof("[SQL] %v", sql)
		}
	}
}

func (b *coreBase) SetParams(params map[string]string) {}

var (
	dialects = map[string]func() coreDialect{}
)

// RegisterDialect register database dialect
func RegisterDialect(dbName coreDbType, dialectFunc func() coreDialect) {
	if dialectFunc == nil {
		panic("core: Register dialect is nil")
	}
	dialects[strings.ToLower(string(dbName))] = dialectFunc // !nashtsai! allow override dialect
}

// QueryDialect query if registered database dialect
func QueryDialect(dbName coreDbType) coreDialect {
	if d, ok := dialects[strings.ToLower(string(dbName))]; ok {
		return d()
	}
	return nil
}

// Filter is an interface to filter SQL
type coreFilter interface {
	Do(sql string, dialect coreDialect, table *coreTable) string
}

// QuoteFilter filter SQL replace ` to database's own quote character
type coreQuoteFilter struct {
}

func (s *coreQuoteFilter) Do(sql string, dialect coreDialect, table *coreTable) string {
	dummy := dialect.Quote("")
	if len(dummy) != 2 {
		return sql
	}
	prefix, suffix := dummy[0], dummy[1]
	raw := []byte(sql)
	for i, cnt := 0, 0; i < len(raw); i = i + 1 {
		if raw[i] == '`' {
			if cnt%2 == 0 {
				raw[i] = prefix
			} else {
				raw[i] = suffix
			}
			cnt++
		}
	}
	return string(raw)
}

// IdFilter filter SQL replace (id) to primary key column name
type coreIdFilter struct {
}

type coreQuoter struct {
	dialect coreDialect
}

func NewQuoter(dialect coreDialect) *coreQuoter {
	return &coreQuoter{dialect}
}

func (q *coreQuoter) Quote(content string) string {
	return q.dialect.Quote(content)
}

func (i *coreIdFilter) Do(sql string, dialect coreDialect, table *coreTable) string {
	quoter := NewQuoter(dialect)
	if table != nil && len(table.PrimaryKeys) == 1 {
		sql = strings.Replace(sql, " `(id)` ", " "+quoter.Quote(table.PrimaryKeys[0])+" ", -1)
		sql = strings.Replace(sql, " "+quoter.Quote("(id)")+" ", " "+quoter.Quote(table.PrimaryKeys[0])+" ", -1)
		return strings.Replace(sql, " (id) ", " "+quoter.Quote(table.PrimaryKeys[0])+" ", -1)
	}
	return sql
}

// SeqFilter filter SQL replace ?, ? ... to $1, $2 ...
type coreSeqFilter struct {
	Prefix string
	Start  int
}

func convertQuestionMark(sql, prefix string, start int) string {
	var buf strings.Builder
	var beginSingleQuote bool
	var index = start
	for _, c := range sql {
		if !beginSingleQuote && c == '?' {
			buf.WriteString(fmt.Sprintf("%s%v", prefix, index))
			index++
		} else {
			if c == '\'' {
				beginSingleQuote = !beginSingleQuote
			}
			buf.WriteRune(c)
		}
	}
	return buf.String()
}

func (s *coreSeqFilter) Do(sql string, dialect coreDialect, table *coreTable) string {
	return convertQuestionMark(sql, s.Prefix, s.Start)
}

// LogLevel defines a log level
type coreLogLevel int

// enumerate all LogLevels
const (
	// !nashtsai! following level also match syslog.Priority value
	LOG_DEBUG coreLogLevel = iota
	LOG_INFO
	LOG_WARNING
	LOG_ERR
	LOG_OFF
	LOG_UNKNOWN
)

// ILogger is a logger interface
type coreILogger interface {
	Debug(v ...interface{})
	Debugf(format string, v ...interface{})
	Error(v ...interface{})
	Errorf(format string, v ...interface{})
	Info(v ...interface{})
	Infof(format string, v ...interface{})
	Warn(v ...interface{})
	Warnf(format string, v ...interface{})

	// Level() LogLevel
	SetLevel(l coreLogLevel)

	ShowSQL(show ...bool)
	IsShowSQL() bool
}

// enumerate all index types
const (
	IndexType = iota + 1
	UniqueType
)

// Index represents a database index
type coreIndex struct {
	IsRegular bool
	Name      string
	Type      int
	Cols      []string
}

func (index *coreIndex) XName(tableName string) string {
	if !strings.HasPrefix(index.Name, "UQE_") &&
		!strings.HasPrefix(index.Name, "IDX_") {
		tableParts := strings.Split(strings.Replace(tableName, `"`, "", -1), ".")
		tableName = tableParts[len(tableParts)-1]
		if index.Type == UniqueType {
			return fmt.Sprintf("UQE_%v_%v", tableName, index.Name)
		}
		return fmt.Sprintf("IDX_%v_%v", tableName, index.Name)
	}
	return index.Name
}

// AddColumn add columns which will be composite index
func (index *coreIndex) AddColumn(cols ...string) {
	for _, col := range cols {
		index.Cols = append(index.Cols, col)
	}
}

func (index *coreIndex) Equal(dst *coreIndex) bool {
	if index.Type != dst.Type {
		return false
	}
	if len(index.Cols) != len(dst.Cols) {
		return false
	}

	for i := 0; i < len(index.Cols); i++ {
		var found bool
		for j := 0; j < len(dst.Cols); j++ {
			if index.Cols[i] == dst.Cols[j] {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// NewIndex new an index object
func NewIndex(name string, indexType int) *coreIndex {
	return &coreIndex{true, name, indexType, make([]string, 0)}
}

// IMapper represents a name convertation between struct's fields name and table's column name
type coreIMapper interface {
	Obj2Table(string) string
	Table2Obj(string) string
}

type coreCacheMapper struct {
	oriMapper      coreIMapper
	obj2tableCache map[string]string
	obj2tableMutex sync.RWMutex
	table2objCache map[string]string
	table2objMutex sync.RWMutex
}

func NewCacheMapper(mapper coreIMapper) *coreCacheMapper {
	return &coreCacheMapper{oriMapper: mapper, obj2tableCache: make(map[string]string),
		table2objCache: make(map[string]string),
	}
}

func (m *coreCacheMapper) Obj2Table(o string) string {
	m.obj2tableMutex.RLock()
	t, ok := m.obj2tableCache[o]
	m.obj2tableMutex.RUnlock()
	if ok {
		return t
	}

	t = m.oriMapper.Obj2Table(o)
	m.obj2tableMutex.Lock()
	m.obj2tableCache[o] = t
	m.obj2tableMutex.Unlock()
	return t
}

func (m *coreCacheMapper) Table2Obj(t string) string {
	m.table2objMutex.RLock()
	o, ok := m.table2objCache[t]
	m.table2objMutex.RUnlock()
	if ok {
		return o
	}

	o = m.oriMapper.Table2Obj(t)
	m.table2objMutex.Lock()
	m.table2objCache[t] = o
	m.table2objMutex.Unlock()
	return o
}

// SnakeMapper implements IMapper and provides name transaltion between
// struct and database table
type coreSnakeMapper struct {
}

func snakeCasedName(name string) string {
	newstr := make([]rune, 0)
	for idx, chr := range name {
		if isUpper := 'A' <= chr && chr <= 'Z'; isUpper {
			if idx > 0 {
				newstr = append(newstr, '_')
			}
			chr -= ('A' - 'a')
		}
		newstr = append(newstr, chr)
	}

	return string(newstr)
}

func (mapper coreSnakeMapper) Obj2Table(name string) string {
	return snakeCasedName(name)
}

func titleCasedName(name string) string {
	newstr := make([]rune, 0)
	upNextChar := true

	name = strings.ToLower(name)

	for _, chr := range name {
		switch {
		case upNextChar:
			upNextChar = false
			if 'a' <= chr && chr <= 'z' {
				chr -= ('a' - 'A')
			}
		case chr == '_':
			upNextChar = true
			continue
		}

		newstr = append(newstr, chr)
	}

	return string(newstr)
}

func (mapper coreSnakeMapper) Table2Obj(name string) string {
	return titleCasedName(name)
}

type coreRows struct {
	*sql.Rows
	db *coreDB
}

// scan data to a struct's pointer according field index
func (rs *coreRows) ScanStructByIndex(dest ...interface{}) error {
	if len(dest) == 0 {
		return errors.New("at least one struct")
	}

	vvvs := make([]reflect.Value, len(dest))
	for i, s := range dest {
		vv := reflect.ValueOf(s)
		if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
			return errors.New("dest should be a struct's pointer")
		}

		vvvs[i] = vv.Elem()
	}

	cols, err := rs.Columns()
	if err != nil {
		return err
	}
	newDest := make([]interface{}, len(cols))

	var i = 0
	for _, vvv := range vvvs {
		for j := 0; j < vvv.NumField(); j++ {
			newDest[i] = vvv.Field(j).Addr().Interface()
			i = i + 1
		}
	}

	return rs.Rows.Scan(newDest...)
}

var (
	fieldCache      = make(map[reflect.Type]map[string]int)
	fieldCacheMutex sync.RWMutex
)

func fieldByName(v reflect.Value, name string) reflect.Value {
	t := v.Type()
	fieldCacheMutex.RLock()
	cache, ok := fieldCache[t]
	fieldCacheMutex.RUnlock()
	if !ok {
		cache = make(map[string]int)
		for i := 0; i < v.NumField(); i++ {
			cache[t.Field(i).Name] = i
		}
		fieldCacheMutex.Lock()
		fieldCache[t] = cache
		fieldCacheMutex.Unlock()
	}

	if i, ok := cache[name]; ok {
		return v.Field(i)
	}

	return reflect.Zero(t)
}

// scan data to a slice's pointer, slice's length should equal to columns' number
func (rs *coreRows) ScanSlice(dest interface{}) error {
	vv := reflect.ValueOf(dest)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Slice {
		return errors.New("dest should be a slice's pointer")
	}

	vvv := vv.Elem()
	cols, err := rs.Columns()
	if err != nil {
		return err
	}

	newDest := make([]interface{}, len(cols))

	for j := 0; j < len(cols); j++ {
		if j >= vvv.Len() {
			newDest[j] = reflect.New(vvv.Type().Elem()).Interface()
		} else {
			newDest[j] = vvv.Index(j).Addr().Interface()
		}
	}

	err = rs.Rows.Scan(newDest...)
	if err != nil {
		return err
	}

	srcLen := vvv.Len()
	for i := srcLen; i < len(cols); i++ {
		vvv = reflect.Append(vvv, reflect.ValueOf(newDest[i]).Elem())
	}
	return nil
}

type coreRow struct {
	rows *coreRows
	// One of these two will be non-nil:
	err error // deferred error for easy chaining
}

// NewRow from rows
func NewRow(rows *coreRows, err error) *coreRow {
	return &coreRow{rows, err}
}

func (row *coreRow) Columns() ([]string, error) {
	if row.err != nil {
		return nil, row.err
	}
	return row.rows.Columns()
}

func (row *coreRow) Scan(dest ...interface{}) error {
	if row.err != nil {
		return row.err
	}
	defer row.rows.Close()

	for _, dp := range dest {
		if _, ok := dp.(*sql.RawBytes); ok {
			return errors.New("sql: RawBytes isn't allowed on Row.Scan")
		}
	}

	if !row.rows.Next() {
		if err := row.rows.Err(); err != nil {
			return err
		}
		return sql.ErrNoRows
	}
	err := row.rows.Scan(dest...)
	if err != nil {
		return err
	}
	// Make sure the query can be processed to completion with no errors.
	return row.rows.Close()
}

// scan data to a slice's pointer, slice's length should equal to columns' number
func (row *coreRow) ScanSlice(dest interface{}) error {
	if row.err != nil {
		return row.err
	}
	defer row.rows.Close()

	if !row.rows.Next() {
		if err := row.rows.Err(); err != nil {
			return err
		}
		return sql.ErrNoRows
	}
	err := row.rows.ScanSlice(dest)
	if err != nil {
		return err
	}

	// Make sure the query can be processed to completion with no errors.
	return row.rows.Close()
}

type coreTable struct {
	Name          string
	Type          reflect.Type
	columnsSeq    []string
	columnsMap    map[string][]*coreColumn
	columns       []*coreColumn
	Indexes       map[string]*coreIndex
	PrimaryKeys   []string
	AutoIncrement string
	Created       map[string]bool
	Updated       string
	Deleted       string
	Version       string
	StoreEngine   string
	Charset       string
	Comment       string
}

func (table *coreTable) Columns() []*coreColumn {
	return table.columns
}

func (table *coreTable) ColumnsSeq() []string {
	return table.columnsSeq
}

func NewEmptyTable() *coreTable {
	return NewTable("", nil)
}

// NewTable creates a new Table object
func NewTable(name string, t reflect.Type) *coreTable {
	return &coreTable{Name: name, Type: t,
		columnsSeq:  make([]string, 0),
		columns:     make([]*coreColumn, 0),
		columnsMap:  make(map[string][]*coreColumn),
		Indexes:     make(map[string]*coreIndex),
		Created:     make(map[string]bool),
		PrimaryKeys: make([]string, 0),
	}
}

func (table *coreTable) columnsByName(name string) []*coreColumn {
	n := len(name)

	for k := range table.columnsMap {
		if len(k) != n {
			continue
		}
		if strings.EqualFold(k, name) {
			return table.columnsMap[k]
		}
	}
	return nil
}

func (table *coreTable) GetColumn(name string) *coreColumn {

	cols := table.columnsByName(name)

	if cols != nil {
		return cols[0]
	}

	return nil
}

func (table *coreTable) GetColumnIdx(name string, idx int) *coreColumn {
	cols := table.columnsByName(name)

	if cols != nil && idx < len(cols) {
		return cols[idx]
	}

	return nil
}

// PKColumns reprents all primary key columns
func (table *coreTable) PKColumns() []*coreColumn {
	columns := make([]*coreColumn, len(table.PrimaryKeys))
	for i, name := range table.PrimaryKeys {
		columns[i] = table.GetColumn(name)
	}
	return columns
}

func (table *coreTable) ColumnType(name string) reflect.Type {
	t, _ := table.Type.FieldByName(name)
	return t.Type
}

func (table *coreTable) AutoIncrColumn() *coreColumn {
	return table.GetColumn(table.AutoIncrement)
}

func (table *coreTable) VersionColumn() *coreColumn {
	return table.GetColumn(table.Version)
}

func (table *coreTable) UpdatedColumn() *coreColumn {
	return table.GetColumn(table.Updated)
}

func (table *coreTable) DeletedColumn() *coreColumn {
	return table.GetColumn(table.Deleted)
}

// AddColumn adds a column to table
func (table *coreTable) AddColumn(col *coreColumn) {
	table.columnsSeq = append(table.columnsSeq, col.Name)
	table.columns = append(table.columns, col)
	colName := strings.ToLower(col.Name)
	if c, ok := table.columnsMap[colName]; ok {
		table.columnsMap[colName] = append(c, col)
	} else {
		table.columnsMap[colName] = []*coreColumn{col}
	}

	if col.IsPrimaryKey {
		table.PrimaryKeys = append(table.PrimaryKeys, col.Name)
	}
	if col.IsAutoIncrement {
		table.AutoIncrement = col.Name
	}
	if col.IsCreated {
		table.Created[col.Name] = true
	}
	if col.IsUpdated {
		table.Updated = col.Name
	}
	if col.IsDeleted {
		table.Deleted = col.Name
	}
	if col.IsVersion {
		table.Version = col.Name
	}
}

// AddIndex adds an index or an unique to table
func (table *coreTable) AddIndex(index *coreIndex) {
	table.Indexes[index.Name] = index
}

const (
	POSTGRES = "postgres"
	SQLITE   = "sqlite3"
	MYSQL    = "mysql"
	MSSQL    = "mssql"
	ORACLE   = "oracle"
)

// xorm SQL types
type coreSQLType struct {
	Name           string
	DefaultLength  int
	DefaultLength2 int
}

const (
	UNKNOW_TYPE = iota
	TEXT_TYPE
	BLOB_TYPE
	TIME_TYPE
	NUMERIC_TYPE
)

func (s *coreSQLType) IsType(st int) bool {
	if t, ok := SqlTypes[s.Name]; ok && t == st {
		return true
	}
	return false
}

func (s *coreSQLType) IsText() bool {
	return s.IsType(TEXT_TYPE)
}

func (s *coreSQLType) IsBlob() bool {
	return s.IsType(BLOB_TYPE)
}

func (s *coreSQLType) IsTime() bool {
	return s.IsType(TIME_TYPE)
}

func (s *coreSQLType) IsNumeric() bool {
	return s.IsType(NUMERIC_TYPE)
}

func (s *coreSQLType) IsJson() bool {
	return s.Name == Json || s.Name == Jsonb
}

var (
	Bit       = "BIT"
	TinyInt   = "TINYINT"
	SmallInt  = "SMALLINT"
	MediumInt = "MEDIUMINT"
	Int       = "INT"
	Integer   = "INTEGER"
	BigInt    = "BIGINT"

	Enum = "ENUM"
	Set  = "SET"

	Char             = "CHAR"
	Varchar          = "VARCHAR"
	NChar            = "NCHAR"
	NVarchar         = "NVARCHAR"
	TinyText         = "TINYTEXT"
	Text             = "TEXT"
	NText            = "NTEXT"
	Clob             = "CLOB"
	MediumText       = "MEDIUMTEXT"
	LongText         = "LONGTEXT"
	Uuid             = "UUID"
	UniqueIdentifier = "UNIQUEIDENTIFIER"
	SysName          = "SYSNAME"

	Date          = "DATE"
	DateTime      = "DATETIME"
	SmallDateTime = "SMALLDATETIME"
	Time          = "TIME"
	TimeStamp     = "TIMESTAMP"
	TimeStampz    = "TIMESTAMPZ"
	Year          = "YEAR"

	Decimal    = "DECIMAL"
	Numeric    = "NUMERIC"
	Money      = "MONEY"
	SmallMoney = "SMALLMONEY"

	Real   = "REAL"
	Float  = "FLOAT"
	Double = "DOUBLE"

	Binary     = "BINARY"
	VarBinary  = "VARBINARY"
	TinyBlob   = "TINYBLOB"
	Blob       = "BLOB"
	MediumBlob = "MEDIUMBLOB"
	LongBlob   = "LONGBLOB"
	Bytea      = "BYTEA"

	Bool    = "BOOL"
	Boolean = "BOOLEAN"

	Serial    = "SERIAL"
	BigSerial = "BIGSERIAL"

	Json  = "JSON"
	Jsonb = "JSONB"

	SqlTypes = map[string]int{
		Bit:       NUMERIC_TYPE,
		TinyInt:   NUMERIC_TYPE,
		SmallInt:  NUMERIC_TYPE,
		MediumInt: NUMERIC_TYPE,
		Int:       NUMERIC_TYPE,
		Integer:   NUMERIC_TYPE,
		BigInt:    NUMERIC_TYPE,

		Enum:  TEXT_TYPE,
		Set:   TEXT_TYPE,
		Json:  TEXT_TYPE,
		Jsonb: TEXT_TYPE,

		Char:       TEXT_TYPE,
		NChar:      TEXT_TYPE,
		Varchar:    TEXT_TYPE,
		NVarchar:   TEXT_TYPE,
		TinyText:   TEXT_TYPE,
		Text:       TEXT_TYPE,
		NText:      TEXT_TYPE,
		MediumText: TEXT_TYPE,
		LongText:   TEXT_TYPE,
		Uuid:       TEXT_TYPE,
		Clob:       TEXT_TYPE,
		SysName:    TEXT_TYPE,

		Date:          TIME_TYPE,
		DateTime:      TIME_TYPE,
		Time:          TIME_TYPE,
		TimeStamp:     TIME_TYPE,
		TimeStampz:    TIME_TYPE,
		SmallDateTime: TIME_TYPE,
		Year:          TIME_TYPE,

		Decimal:    NUMERIC_TYPE,
		Numeric:    NUMERIC_TYPE,
		Real:       NUMERIC_TYPE,
		Float:      NUMERIC_TYPE,
		Double:     NUMERIC_TYPE,
		Money:      NUMERIC_TYPE,
		SmallMoney: NUMERIC_TYPE,

		Binary:    BLOB_TYPE,
		VarBinary: BLOB_TYPE,

		TinyBlob:         BLOB_TYPE,
		Blob:             BLOB_TYPE,
		MediumBlob:       BLOB_TYPE,
		LongBlob:         BLOB_TYPE,
		Bytea:            BLOB_TYPE,
		UniqueIdentifier: BLOB_TYPE,

		Bool: NUMERIC_TYPE,

		Serial:    NUMERIC_TYPE,
		BigSerial: NUMERIC_TYPE,
	}

	intTypes  = sort.StringSlice{"*int", "*int16", "*int32", "*int8"}
	uintTypes = sort.StringSlice{"*uint", "*uint16", "*uint32", "*uint8"}
)

// !nashtsai! treat following var as interal const values, these are used for reflect.TypeOf comparison
var (
	c_EMPTY_STRING       string
	c_BOOL_DEFAULT       bool
	c_BYTE_DEFAULT       byte
	c_COMPLEX64_DEFAULT  complex64
	c_COMPLEX128_DEFAULT complex128
	c_FLOAT32_DEFAULT    float32
	c_FLOAT64_DEFAULT    float64
	c_INT64_DEFAULT      int64
	c_UINT64_DEFAULT     uint64
	c_INT32_DEFAULT      int32
	c_UINT32_DEFAULT     uint32
	c_INT16_DEFAULT      int16
	c_UINT16_DEFAULT     uint16
	c_INT8_DEFAULT       int8
	c_UINT8_DEFAULT      uint8
	c_INT_DEFAULT        int
	c_UINT_DEFAULT       uint
	c_TIME_DEFAULT       time.Time
)

var (
	IntType   = reflect.TypeOf(c_INT_DEFAULT)
	Int8Type  = reflect.TypeOf(c_INT8_DEFAULT)
	Int16Type = reflect.TypeOf(c_INT16_DEFAULT)
	Int32Type = reflect.TypeOf(c_INT32_DEFAULT)
	Int64Type = reflect.TypeOf(c_INT64_DEFAULT)

	UintType   = reflect.TypeOf(c_UINT_DEFAULT)
	Uint8Type  = reflect.TypeOf(c_UINT8_DEFAULT)
	Uint16Type = reflect.TypeOf(c_UINT16_DEFAULT)
	Uint32Type = reflect.TypeOf(c_UINT32_DEFAULT)
	Uint64Type = reflect.TypeOf(c_UINT64_DEFAULT)

	Float32Type = reflect.TypeOf(c_FLOAT32_DEFAULT)
	Float64Type = reflect.TypeOf(c_FLOAT64_DEFAULT)

	Complex64Type  = reflect.TypeOf(c_COMPLEX64_DEFAULT)
	Complex128Type = reflect.TypeOf(c_COMPLEX128_DEFAULT)

	StringType = reflect.TypeOf(c_EMPTY_STRING)
	BoolType   = reflect.TypeOf(c_BOOL_DEFAULT)
	ByteType   = reflect.TypeOf(c_BYTE_DEFAULT)
	BytesType  = reflect.SliceOf(ByteType)

	TimeType = reflect.TypeOf(c_TIME_DEFAULT)
)

var (
	PtrIntType   = reflect.PtrTo(IntType)
	PtrInt8Type  = reflect.PtrTo(Int8Type)
	PtrInt16Type = reflect.PtrTo(Int16Type)
	PtrInt32Type = reflect.PtrTo(Int32Type)
	PtrInt64Type = reflect.PtrTo(Int64Type)

	PtrUintType   = reflect.PtrTo(UintType)
	PtrUint8Type  = reflect.PtrTo(Uint8Type)
	PtrUint16Type = reflect.PtrTo(Uint16Type)
	PtrUint32Type = reflect.PtrTo(Uint32Type)
	PtrUint64Type = reflect.PtrTo(Uint64Type)

	PtrFloat32Type = reflect.PtrTo(Float32Type)
	PtrFloat64Type = reflect.PtrTo(Float64Type)

	PtrComplex64Type  = reflect.PtrTo(Complex64Type)
	PtrComplex128Type = reflect.PtrTo(Complex128Type)

	PtrStringType = reflect.PtrTo(StringType)
	PtrBoolType   = reflect.PtrTo(BoolType)
	PtrByteType   = reflect.PtrTo(ByteType)

	PtrTimeType = reflect.PtrTo(TimeType)
)

// Type2SQLType generate SQLType acorrding Go's type
func Type2SQLType(t reflect.Type) (st coreSQLType) {
	switch k := t.Kind(); k {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32:
		st = coreSQLType{Int, 0, 0}
	case reflect.Int64, reflect.Uint64:
		st = coreSQLType{BigInt, 0, 0}
	case reflect.Float32:
		st = coreSQLType{Float, 0, 0}
	case reflect.Float64:
		st = coreSQLType{Double, 0, 0}
	case reflect.Complex64, reflect.Complex128:
		st = coreSQLType{Varchar, 64, 0}
	case reflect.Array, reflect.Slice, reflect.Map:
		if t.Elem() == reflect.TypeOf(c_BYTE_DEFAULT) {
			st = coreSQLType{Blob, 0, 0}
		} else {
			st = coreSQLType{Text, 0, 0}
		}
	case reflect.Bool:
		st = coreSQLType{Bool, 0, 0}
	case reflect.String:
		st = coreSQLType{Varchar, 255, 0}
	case reflect.Struct:
		if t.ConvertibleTo(TimeType) {
			st = coreSQLType{DateTime, 0, 0}
		} else {
			// TODO need to handle association struct
			st = coreSQLType{Text, 0, 0}
		}
	case reflect.Ptr:
		st = Type2SQLType(t.Elem())
	default:
		st = coreSQLType{Text, 0, 0}
	}
	return
}

// default sql type change to go types
func SQLType2Type(st coreSQLType) reflect.Type {
	name := strings.ToUpper(st.Name)
	switch name {
	case Bit, TinyInt, SmallInt, MediumInt, Int, Integer, Serial:
		return reflect.TypeOf(1)
	case BigInt, BigSerial:
		return reflect.TypeOf(int64(1))
	case Float, Real:
		return reflect.TypeOf(float32(1))
	case Double:
		return reflect.TypeOf(float64(1))
	case Char, NChar, Varchar, NVarchar, TinyText, Text, NText, MediumText, LongText, Enum, Set, Uuid, Clob, SysName:
		return reflect.TypeOf("")
	case TinyBlob, Blob, LongBlob, Bytea, Binary, MediumBlob, VarBinary, UniqueIdentifier:
		return reflect.TypeOf([]byte{})
	case Bool:
		return reflect.TypeOf(true)
	case DateTime, Date, Time, TimeStamp, TimeStampz, SmallDateTime, Year:
		return reflect.TypeOf(c_TIME_DEFAULT)
	case Decimal, Numeric, Money, SmallMoney:
		return reflect.TypeOf("")
	default:
		return reflect.TypeOf("")
	}
}
