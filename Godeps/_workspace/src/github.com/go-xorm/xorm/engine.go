package xorm

import (
	"bufio"
	"bytes"
	"database/sql"
	"encoding/gob"
	"errors"
	"fmt"
	"io"
	"os"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-xorm/core"
)

// Engine is the major struct of xorm, it means a database manager.
// Commonly, an application only need one engine
type Engine struct {
	db      *core.DB
	dialect core.Dialect

	ColumnMapper  core.IMapper
	TableMapper   core.IMapper
	TagIdentifier string
	Tables        map[reflect.Type]*core.Table

	mutex  *sync.RWMutex
	Cacher core.Cacher

	ShowSQL bool

	// !nashtsai! TODO ought to deprecate these but having logger to control its log level
	ShowInfo  bool
	ShowErr   bool
	ShowDebug bool
	ShowWarn  bool
	// --227

	Logger     core.ILogger
	TZLocation *time.Location

	disableGlobalCache bool
}

func (engine *Engine) SetLogger(logger core.ILogger) {
	engine.Logger = logger
	engine.dialect.SetLogger(logger)
}

func (engine *Engine) SetDisableGlobalCache(disable bool) {
	if engine.disableGlobalCache != disable {
		engine.disableGlobalCache = disable
	}
}

func (engine *Engine) DriverName() string {
	return engine.dialect.DriverName()
}

func (engine *Engine) DataSourceName() string {
	return engine.dialect.DataSourceName()
}

func (engine *Engine) SetMapper(mapper core.IMapper) {
	engine.SetTableMapper(mapper)
	engine.SetColumnMapper(mapper)
}

func (engine *Engine) SetTableMapper(mapper core.IMapper) {
	engine.TableMapper = mapper
}

func (engine *Engine) SetColumnMapper(mapper core.IMapper) {
	engine.ColumnMapper = mapper
}

// If engine's database support batch insert records like
// "insert into user values (name, age), (name, age)".
// When the return is ture, then engine.Insert(&users) will
// generate batch sql and exeute.
func (engine *Engine) SupportInsertMany() bool {
	return engine.dialect.SupportInsertMany()
}

// Engine's database use which charactor as quote.
// mysql, sqlite use ` and postgres use "
func (engine *Engine) QuoteStr() string {
	return engine.dialect.QuoteStr()
}

// Use QuoteStr quote the string sql
func (engine *Engine) Quote(sql string) string {
	if len(sql) == 0 {
		return sql
	}
	if string(sql[0]) == engine.dialect.QuoteStr() || sql[0] == '`' {
		return sql
	}
	return engine.dialect.QuoteStr() + sql + engine.dialect.QuoteStr()
}

// A simple wrapper to dialect's core.SqlType method
func (engine *Engine) SqlType(c *core.Column) string {
	return engine.dialect.SqlType(c)
}

// Database's autoincrement statement
func (engine *Engine) AutoIncrStr() string {
	return engine.dialect.AutoIncrStr()
}

// SetMaxOpenConns is only available for go 1.2+
func (engine *Engine) SetMaxOpenConns(conns int) {
	engine.db.SetMaxOpenConns(conns)
}

// @Deprecated
func (engine *Engine) SetMaxConns(conns int) {
	engine.SetMaxOpenConns(conns)
}

// SetMaxIdleConns
func (engine *Engine) SetMaxIdleConns(conns int) {
	engine.db.SetMaxIdleConns(conns)
}

// SetDefaltCacher set the default cacher. Xorm's default not enable cacher.
func (engine *Engine) SetDefaultCacher(cacher core.Cacher) {
	engine.Cacher = cacher
}

// If you has set default cacher, and you want temporilly stop use cache,
// you can use NoCache()
func (engine *Engine) NoCache() *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.NoCache()
}

func (engine *Engine) NoCascade() *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.NoCascade()
}

// Set a table use a special cacher
func (engine *Engine) MapCacher(bean interface{}, cacher core.Cacher) {
	v := rValue(bean)
	tb := engine.autoMapType(v)
	tb.Cacher = cacher
}

// NewDB provides an interface to operate database directly
func (engine *Engine) NewDB() (*core.DB, error) {
	return core.OpenDialect(engine.dialect)
}

func (engine *Engine) DB() *core.DB {
	return engine.db
}

func (engine *Engine) Dialect() core.Dialect {
	return engine.dialect
}

// New a session
func (engine *Engine) NewSession() *Session {
	session := &Session{Engine: engine}
	session.Init()
	return session
}

// Close the engine
func (engine *Engine) Close() error {
	return engine.db.Close()
}

// Ping tests if database is alive
func (engine *Engine) Ping() error {
	session := engine.NewSession()
	defer session.Close()
	engine.LogInfo("PING DATABASE", engine.DriverName)
	return session.Ping()
}

// logging sql
func (engine *Engine) logSQL(sqlStr string, sqlArgs ...interface{}) {
	if engine.ShowSQL {
		engine.overrideLogLevel(core.LOG_INFO)
		if len(sqlArgs) > 0 {
			engine.Logger.Infof("[sql] %v [args] %v", sqlStr, sqlArgs)
		} else {
			engine.Logger.Infof("[sql] %v", sqlStr)
		}
	}
}

func (engine *Engine) LogSQLQueryTime(sqlStr string, args interface{}, executionBlock func() (*core.Stmt, *core.Rows, error)) (*core.Stmt, *core.Rows, error) {
	if engine.ShowDebug {
		b4ExecTime := time.Now()
		stmt, res, err := executionBlock()
		execDuration := time.Since(b4ExecTime)
		engine.LogDebugf("[time] %s - args %v - query took: %vns", sqlStr, args, execDuration.Nanoseconds())
		return stmt, res, err
	} else {
		return executionBlock()
	}
}

func (engine *Engine) LogSQLExecutionTime(sqlStr string, args interface{}, executionBlock func() (sql.Result, error)) (sql.Result, error) {
	if engine.ShowDebug {
		b4ExecTime := time.Now()
		res, err := executionBlock()
		execDuration := time.Since(b4ExecTime)
		engine.LogDebugf("[time] %s - args %v - execution took: %vns", sqlStr, args, execDuration.Nanoseconds())
		return res, err
	} else {
		return executionBlock()
	}
}

// logging error
func (engine *Engine) overrideLogLevel(overrideLevel core.LogLevel) {
	logLevel := engine.Logger.Level()
	if logLevel == core.LOG_UNKNOWN {
		// intend to left empty
	} else if logLevel < overrideLevel { // TODO can remove if deprecated engine.ShowErr
		engine.Logger.SetLevel(core.LOG_ERR) // try override logger's log level
	}

}

func (engine *Engine) LogError(contents ...interface{}) {
	if engine.ShowErr {
		engine.overrideLogLevel(core.LOG_ERR)
		engine.Logger.Err(contents...)
	}
}

func (engine *Engine) LogErrorf(format string, contents ...interface{}) {
	if engine.ShowErr {
		engine.overrideLogLevel(core.LOG_ERR)
		engine.Logger.Errf(format, contents...)
	}
}

// logging info
func (engine *Engine) LogInfo(contents ...interface{}) {
	if engine.ShowInfo {
		engine.overrideLogLevel(core.LOG_INFO)
		engine.Logger.Info(contents...)
	}
}

func (engine *Engine) LogInfof(format string, contents ...interface{}) {
	if engine.ShowErr {
		engine.overrideLogLevel(core.LOG_INFO)
		engine.Logger.Infof(format, contents...)
	}
}

// logging debug
func (engine *Engine) LogDebug(contents ...interface{}) {
	if engine.ShowDebug {
		engine.overrideLogLevel(core.LOG_DEBUG)
		engine.Logger.Debug(contents...)
	}
}

func (engine *Engine) LogDebugf(format string, contents ...interface{}) {
	if engine.ShowDebug {
		engine.overrideLogLevel(core.LOG_DEBUG)
		engine.Logger.Debugf(format, contents...)
	}
}

// logging warn
func (engine *Engine) LogWarn(contents ...interface{}) {
	if engine.ShowWarn {
		engine.overrideLogLevel(core.LOG_WARNING)
		engine.Logger.Warning(contents...)
	}
}

func (engine *Engine) LogWarnf(format string, contents ...interface{}) {
	if engine.ShowWarn {
		engine.overrideLogLevel(core.LOG_WARNING)
		engine.Logger.Warningf(format, contents...)
	}
}

// Sql method let's you manualy write raw sql and operate
// For example:
//
//         engine.Sql("select * from user").Find(&users)
//
// This    code will execute "select * from user" and set the records to users
//
func (engine *Engine) Sql(querystring string, args ...interface{}) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Sql(querystring, args...)
}

// Default if your struct has "created" or "updated" filed tag, the fields
// will automatically be filled with current time when Insert or Update
// invoked. Call NoAutoTime if you dont' want to fill automatically.
func (engine *Engine) NoAutoTime() *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.NoAutoTime()
}

// Retrieve all tables, columns, indexes' informations from database.
func (engine *Engine) DBMetas() ([]*core.Table, error) {
	tables, err := engine.dialect.GetTables()
	if err != nil {
		return nil, err
	}

	for _, table := range tables {
		colSeq, cols, err := engine.dialect.GetColumns(table.Name)
		if err != nil {
			return nil, err
		}
		for _, name := range colSeq {
			table.AddColumn(cols[name])
		}
		//table.Columns = cols
		//table.ColumnsSeq = colSeq
		indexes, err := engine.dialect.GetIndexes(table.Name)
		if err != nil {
			return nil, err
		}
		table.Indexes = indexes

		for _, index := range indexes {
			for _, name := range index.Cols {
				if col := table.GetColumn(name); col != nil {
					col.Indexes[index.Name] = true
				} else {
					return nil, fmt.Errorf("Unknown col "+name+" in indexes %v of table", index, table.ColumnsSeq())
				}
			}
		}
	}
	return tables, nil
}

/*
dump database all table structs and data to a file
*/
func (engine *Engine) DumpAllToFile(fp string) error {
	f, err := os.Create(fp)
	if err != nil {
		return err
	}
	defer f.Close()
	return engine.DumpAll(f)
}

/*
dump database all table structs and data to w
*/
func (engine *Engine) DumpAll(w io.Writer) error {
	tables, err := engine.DBMetas()
	if err != nil {
		return err
	}

	for _, table := range tables {
		_, err = io.WriteString(w, engine.dialect.CreateTableSql(table, "", table.StoreEngine, "")+"\n\n")
		if err != nil {
			return err
		}
		for _, index := range table.Indexes {
			_, err = io.WriteString(w, engine.dialect.CreateIndexSql(table.Name, index)+"\n\n")
			if err != nil {
				return err
			}
		}

		rows, err := engine.DB().Query("SELECT * FROM " + engine.Quote(table.Name))
		if err != nil {
			return err
		}

		cols, err := rows.Columns()
		if err != nil {
			return err
		}
		if len(cols) == 0 {
			continue
		}
		for rows.Next() {
			dest := make([]interface{}, len(cols))
			err = rows.ScanSlice(&dest)
			if err != nil {
				return err
			}

			_, err = io.WriteString(w, "INSERT INTO "+engine.Quote(table.Name)+" ("+engine.Quote(strings.Join(cols, engine.Quote(", ")))+") VALUES (")
			if err != nil {
				return err
			}

			var temp string
			for i, d := range dest {
				col := table.GetColumn(cols[i])
				if d == nil {
					temp += ", NULL"
				} else if col.SQLType.IsText() || col.SQLType.IsTime() {
					var v = fmt.Sprintf("%s", d)
					temp += ", '" + strings.Replace(v, "'", "''", -1) + "'"
				} else if col.SQLType.IsBlob() {
					if reflect.TypeOf(d).Kind() == reflect.Slice {
						temp += fmt.Sprintf(", %s", engine.dialect.FormatBytes(d.([]byte)))
					} else if reflect.TypeOf(d).Kind() == reflect.String {
						temp += fmt.Sprintf(", '%s'", d.(string))
					}
				} else if col.SQLType.IsNumeric() {
					switch reflect.TypeOf(d).Kind() {
					case reflect.Slice:
						temp += fmt.Sprintf(", %s", string(d.([]byte)))
					default:
						temp += fmt.Sprintf(", %v", d)
					}
				} else {
					s := fmt.Sprintf("%v", d)
					if strings.Contains(s, ":") || strings.Contains(s, "-") {
						temp += fmt.Sprintf(", '%s'", s)
					} else {
						temp += fmt.Sprintf(", %s", s)
					}
				}
			}
			_, err = io.WriteString(w, temp[2:]+");\n\n")
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// use cascade or not
func (engine *Engine) Cascade(trueOrFalse ...bool) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Cascade(trueOrFalse...)
}

// Where method provide a condition query
func (engine *Engine) Where(querystring string, args ...interface{}) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Where(querystring, args...)
}

// Id mehtod provoide a condition as (id) = ?
func (engine *Engine) Id(id interface{}) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Id(id)
}

// Apply before Processor, affected bean is passed to closure arg
func (engine *Engine) Before(closures func(interface{})) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Before(closures)
}

// Apply after insert Processor, affected bean is passed to closure arg
func (engine *Engine) After(closures func(interface{})) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.After(closures)
}

// set charset when create table, only support mysql now
func (engine *Engine) Charset(charset string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Charset(charset)
}

// set store engine when create table, only support mysql now
func (engine *Engine) StoreEngine(storeEngine string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.StoreEngine(storeEngine)
}

// use for distinct columns. Caution: when you are using cache,
// distinct will not be cached because cache system need id,
// but distinct will not provide id
func (engine *Engine) Distinct(columns ...string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Distinct(columns...)
}

// only use the paramters as select or update columns
func (engine *Engine) Cols(columns ...string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Cols(columns...)
}

func (engine *Engine) AllCols() *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.AllCols()
}

func (engine *Engine) MustCols(columns ...string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.MustCols(columns...)
}

// Xorm automatically retrieve condition according struct, but
// if struct has bool field, it will ignore them. So use UseBool
// to tell system to do not ignore them.
// If no paramters, it will use all the bool field of struct, or
// it will use paramters's columns
func (engine *Engine) UseBool(columns ...string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.UseBool(columns...)
}

// Only not use the paramters as select or update columns
func (engine *Engine) Omit(columns ...string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Omit(columns...)
}

// This method will generate "column IN (?, ?)"
func (engine *Engine) In(column string, args ...interface{}) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.In(column, args...)
}

// Method Inc provides a update string like "column = column + ?"
func (engine *Engine) Incr(column string, arg ...interface{}) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Incr(column, arg...)
}

// Method Decr provides a update string like "column = column - ?"
func (engine *Engine) Decr(column string, arg ...interface{}) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Decr(column, arg...)
}

// Method SetExpr provides a update string like "column = {expression}"
func (engine *Engine) SetExpr(column string, expression string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.SetExpr(column, expression)
}

// Temporarily change the Get, Find, Update's table
func (engine *Engine) Table(tableNameOrBean interface{}) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Table(tableNameOrBean)
}

// set the table alias
func (engine *Engine) Alias(alias string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Alias(alias)
}

// This method will generate "LIMIT start, limit"
func (engine *Engine) Limit(limit int, start ...int) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Limit(limit, start...)
}

// Method Desc will generate "ORDER BY column1 DESC, column2 DESC"
// This will
func (engine *Engine) Desc(colNames ...string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Desc(colNames...)
}

// Method Asc will generate "ORDER BY column1,column2 Asc"
// This method can chainable use.
//
//        engine.Desc("name").Asc("age").Find(&users)
//        // SELECT * FROM user ORDER BY name DESC, age ASC
//
func (engine *Engine) Asc(colNames ...string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Asc(colNames...)
}

// Method OrderBy will generate "ORDER BY order"
func (engine *Engine) OrderBy(order string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.OrderBy(order)
}

// The join_operator should be one of INNER, LEFT OUTER, CROSS etc - this will be prepended to JOIN
func (engine *Engine) Join(join_operator string, tablename interface{}, condition string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Join(join_operator, tablename, condition)
}

// Generate Group By statement
func (engine *Engine) GroupBy(keys string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.GroupBy(keys)
}

// Generate Having statement
func (engine *Engine) Having(conditions string) *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Having(conditions)
}

func (engine *Engine) autoMapType(v reflect.Value) *core.Table {
	t := v.Type()
	engine.mutex.RLock()
	table, ok := engine.Tables[t]
	engine.mutex.RUnlock()
	if !ok {
		table = engine.mapType(v)
		engine.mutex.Lock()
		engine.Tables[t] = table
		if v.CanAddr() {
			engine.GobRegister(v.Addr().Interface())
		} else {
			engine.GobRegister(v.Interface())
		}
		engine.mutex.Unlock()
	}
	return table
}

func (engine *Engine) GobRegister(v interface{}) *Engine {
	//fmt.Printf("Type: %[1]T => Data: %[1]#v\n", v)
	gob.Register(v)
	return engine
}

func (engine *Engine) TableInfo(bean interface{}) *core.Table {
	v := rValue(bean)
	return engine.autoMapType(v)
}

func addIndex(indexName string, table *core.Table, col *core.Column, indexType int) {
	if index, ok := table.Indexes[indexName]; ok {
		index.AddColumn(col.Name)
		col.Indexes[index.Name] = true
	} else {
		index := core.NewIndex(indexName, indexType)
		index.AddColumn(col.Name)
		table.AddIndex(index)
		col.Indexes[index.Name] = true
	}
}

func (engine *Engine) newTable() *core.Table {
	table := core.NewEmptyTable()

	if !engine.disableGlobalCache {
		table.Cacher = engine.Cacher
	}
	return table
}

func (engine *Engine) mapType(v reflect.Value) *core.Table {
	t := v.Type()
	table := engine.newTable()
	method := v.MethodByName("TableName")
	if !method.IsValid() {
		if v.CanAddr() {
			method = v.Addr().MethodByName("TableName")
		}
	}
	if method.IsValid() {
		params := []reflect.Value{}
		results := method.Call(params)
		if len(results) == 1 {
			table.Name = results[0].Interface().(string)
		}
	}

	if table.Name == "" {
		table.Name = engine.TableMapper.Obj2Table(t.Name())
	}
	table.Type = t

	var idFieldColName string
	var err error

	hasCacheTag := false
	hasNoCacheTag := false

	for i := 0; i < t.NumField(); i++ {
		tag := t.Field(i).Tag

		ormTagStr := tag.Get(engine.TagIdentifier)
		var col *core.Column
		fieldValue := v.Field(i)
		fieldType := fieldValue.Type()

		if ormTagStr != "" {
			col = &core.Column{FieldName: t.Field(i).Name, Nullable: true, IsPrimaryKey: false,
				IsAutoIncrement: false, MapType: core.TWOSIDES, Indexes: make(map[string]bool)}
			tags := strings.Split(ormTagStr, " ")

			if len(tags) > 0 {
				if tags[0] == "-" {
					continue
				}
				if strings.ToUpper(tags[0]) == "EXTENDS" {
					if fieldValue.Kind() == reflect.Struct {
						parentTable := engine.mapType(fieldValue)
						for _, col := range parentTable.Columns() {
							col.FieldName = fmt.Sprintf("%v.%v", t.Field(i).Name, col.FieldName)
							table.AddColumn(col)
						}

						continue
					} else if fieldValue.Kind() == reflect.Ptr {
						f := fieldValue.Type().Elem()
						if f.Kind() == reflect.Struct {
							fieldValue = fieldValue.Elem()
							if !fieldValue.IsValid() || fieldValue.IsNil() {
								fieldValue = reflect.New(f).Elem()
							}
						}

						parentTable := engine.mapType(fieldValue)
						for _, col := range parentTable.Columns() {
							col.FieldName = fmt.Sprintf("%v.%v", t.Field(i).Name, col.FieldName)
							table.AddColumn(col)
						}

						continue
					}
					//TODO: warning
				}

				indexNames := make(map[string]int)
				var isIndex, isUnique bool
				var preKey string
				for j, key := range tags {
					k := strings.ToUpper(key)
					switch {
					case k == "<-":
						col.MapType = core.ONLYFROMDB
					case k == "->":
						col.MapType = core.ONLYTODB
					case k == "PK":
						col.IsPrimaryKey = true
						col.Nullable = false
					case k == "NULL":
						if j == 0 {
							col.Nullable = true
						} else {
							col.Nullable = (strings.ToUpper(tags[j-1]) != "NOT")
						}
					// TODO: for postgres how add autoincr?
					/*case strings.HasPrefix(k, "AUTOINCR(") && strings.HasSuffix(k, ")"):
					col.IsAutoIncrement = true

					autoStart := k[len("AUTOINCR")+1 : len(k)-1]
					autoStartInt, err := strconv.Atoi(autoStart)
					if err != nil {
						engine.LogError(err)
					}
					col.AutoIncrStart = autoStartInt*/
					case k == "AUTOINCR":
						col.IsAutoIncrement = true
						//col.AutoIncrStart = 1
					case k == "DEFAULT":
						col.Default = tags[j+1]
					case k == "CREATED":
						col.IsCreated = true
					case k == "VERSION":
						col.IsVersion = true
						col.Default = "1"
					case k == "UPDATED":
						col.IsUpdated = true
					case k == "DELETED":
						col.IsDeleted = true
					case strings.HasPrefix(k, "INDEX(") && strings.HasSuffix(k, ")"):
						indexName := k[len("INDEX")+1 : len(k)-1]
						indexNames[indexName] = core.IndexType
					case k == "INDEX":
						isIndex = true
					case strings.HasPrefix(k, "UNIQUE(") && strings.HasSuffix(k, ")"):
						indexName := k[len("UNIQUE")+1 : len(k)-1]
						indexNames[indexName] = core.UniqueType
					case k == "UNIQUE":
						isUnique = true
					case k == "NOTNULL":
						col.Nullable = false
					case k == "CACHE":
						if !hasCacheTag {
							hasCacheTag = true
						}
					case k == "NOCACHE":
						if !hasNoCacheTag {
							hasNoCacheTag = true
						}
					case k == "NOT":
					default:
						if strings.HasPrefix(k, "'") && strings.HasSuffix(k, "'") {
							if preKey != "DEFAULT" {
								col.Name = key[1 : len(key)-1]
							}
						} else if strings.Contains(k, "(") && strings.HasSuffix(k, ")") {
							fs := strings.Split(k, "(")

							if _, ok := core.SqlTypes[fs[0]]; !ok {
								preKey = k
								continue
							}
							col.SQLType = core.SQLType{fs[0], 0, 0}
							if fs[0] == core.Enum && fs[1][0] == '\'' { //enum
								options := strings.Split(fs[1][0:len(fs[1])-1], ",")
								col.EnumOptions = make(map[string]int)
								for k, v := range options {
									v = strings.TrimSpace(v)
									v = strings.Trim(v, "'")
									col.EnumOptions[v] = k
								}
							} else if fs[0] == core.Set && fs[1][0] == '\'' { //set
								options := strings.Split(fs[1][0:len(fs[1])-1], ",")
								col.SetOptions = make(map[string]int)
								for k, v := range options {
									v = strings.TrimSpace(v)
									v = strings.Trim(v, "'")
									col.SetOptions[v] = k
								}
							} else {
								fs2 := strings.Split(fs[1][0:len(fs[1])-1], ",")
								if len(fs2) == 2 {
									col.Length, err = strconv.Atoi(fs2[0])
									if err != nil {
										engine.LogError(err)
									}
									col.Length2, err = strconv.Atoi(fs2[1])
									if err != nil {
										engine.LogError(err)
									}
								} else if len(fs2) == 1 {
									col.Length, err = strconv.Atoi(fs2[0])
									if err != nil {
										engine.LogError(err)
									}
								}
							}
						} else {
							if _, ok := core.SqlTypes[k]; ok {
								col.SQLType = core.SQLType{k, 0, 0}
							} else if key != col.Default {
								col.Name = key
							}
						}
						engine.dialect.SqlType(col)
					}
					preKey = k
				}
				if col.SQLType.Name == "" {
					col.SQLType = core.Type2SQLType(fieldType)
				}
				if col.Length == 0 {
					col.Length = col.SQLType.DefaultLength
				}
				if col.Length2 == 0 {
					col.Length2 = col.SQLType.DefaultLength2
				}

				if col.Name == "" {
					col.Name = engine.ColumnMapper.Obj2Table(t.Field(i).Name)
				}

				if isUnique {
					indexNames[col.Name] = core.UniqueType
				} else if isIndex {
					indexNames[col.Name] = core.IndexType
				}

				for indexName, indexType := range indexNames {
					addIndex(indexName, table, col, indexType)
				}
			}
		} else {
			var sqlType core.SQLType
			if fieldValue.CanAddr() {
				if _, ok := fieldValue.Addr().Interface().(core.Conversion); ok {
					sqlType = core.SQLType{core.Text, 0, 0}
				}
			}
			if _, ok := fieldValue.Interface().(core.Conversion); ok {
				sqlType = core.SQLType{core.Text, 0, 0}
			} else {
				sqlType = core.Type2SQLType(fieldType)
			}
			col = core.NewColumn(engine.ColumnMapper.Obj2Table(t.Field(i).Name),
				t.Field(i).Name, sqlType, sqlType.DefaultLength,
				sqlType.DefaultLength2, true)
		}
		if col.IsAutoIncrement {
			col.Nullable = false
		}

		table.AddColumn(col)

		if fieldType.Kind() == reflect.Int64 && (strings.ToUpper(col.FieldName) == "ID" || strings.HasSuffix(strings.ToUpper(col.FieldName), ".ID")) {
			idFieldColName = col.Name
		}
	} // end for

	if idFieldColName != "" && len(table.PrimaryKeys) == 0 {
		col := table.GetColumn(idFieldColName)
		col.IsPrimaryKey = true
		col.IsAutoIncrement = true
		col.Nullable = false
		table.PrimaryKeys = append(table.PrimaryKeys, col.Name)
		table.AutoIncrement = col.Name
	}

	if hasCacheTag {
		if engine.Cacher != nil { // !nash! use engine's cacher if provided
			engine.Logger.Info("enable cache on table:", table.Name)
			table.Cacher = engine.Cacher
		} else {
			engine.Logger.Info("enable LRU cache on table:", table.Name)
			table.Cacher = NewLRUCacher2(NewMemoryStore(), time.Hour, 10000) // !nashtsai! HACK use LRU cacher for now
		}
	}
	if hasNoCacheTag {
		engine.Logger.Info("no cache on table:", table.Name)
		table.Cacher = nil
	}

	return table
}

// Map a struct to a table
func (engine *Engine) mapping(beans ...interface{}) (e error) {
	engine.mutex.Lock()
	defer engine.mutex.Unlock()
	for _, bean := range beans {
		v := rValue(bean)
		engine.Tables[v.Type()] = engine.mapType(v)
	}
	return
}

// If a table has any reocrd
func (engine *Engine) IsTableEmpty(bean interface{}) (bool, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.IsTableEmpty(bean)
}

// If a table is exist
func (engine *Engine) IsTableExist(beanOrTableName interface{}) (bool, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.IsTableExist(beanOrTableName)
}

func (engine *Engine) IdOf(bean interface{}) core.PK {
	return engine.IdOfV(reflect.ValueOf(bean))
}

func (engine *Engine) IdOfV(rv reflect.Value) core.PK {
	v := reflect.Indirect(rv)
	table := engine.autoMapType(v)
	pk := make([]interface{}, len(table.PrimaryKeys))
	for i, col := range table.PKColumns() {
		pkField := v.FieldByName(col.FieldName)
		switch pkField.Kind() {
		case reflect.String:
			pk[i] = pkField.String()
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			pk[i] = pkField.Int()
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			pk[i] = pkField.Uint()
		}
	}
	return core.PK(pk)
}

// create indexes
func (engine *Engine) CreateIndexes(bean interface{}) error {
	session := engine.NewSession()
	defer session.Close()
	return session.CreateIndexes(bean)
}

// create uniques
func (engine *Engine) CreateUniques(bean interface{}) error {
	session := engine.NewSession()
	defer session.Close()
	return session.CreateUniques(bean)
}

func (engine *Engine) getCacher2(table *core.Table) core.Cacher {
	return table.Cacher
}

func (engine *Engine) getCacher(v reflect.Value) core.Cacher {
	if table := engine.autoMapType(v); table != nil {
		return table.Cacher
	}
	return engine.Cacher
}

// If enabled cache, clear the cache bean
func (engine *Engine) ClearCacheBean(bean interface{}, id string) error {
	t := rType(bean)
	if t.Kind() != reflect.Struct {
		return errors.New("error params")
	}
	table := engine.TableInfo(bean)
	cacher := table.Cacher
	if cacher == nil {
		cacher = engine.Cacher
	}
	if cacher != nil {
		cacher.ClearIds(table.Name)
		cacher.DelBean(table.Name, id)
	}
	return nil
}

// If enabled cache, clear some tables' cache
func (engine *Engine) ClearCache(beans ...interface{}) error {
	for _, bean := range beans {
		t := rType(bean)
		if t.Kind() != reflect.Struct {
			return errors.New("error params")
		}
		table := engine.TableInfo(bean)
		cacher := table.Cacher
		if cacher == nil {
			cacher = engine.Cacher
		}
		if cacher != nil {
			cacher.ClearIds(table.Name)
			cacher.ClearBeans(table.Name)
		}
	}
	return nil
}

// Sync the new struct changes to database, this method will automatically add
// table, column, index, unique. but will not delete or change anything.
// If you change some field, you should change the database manually.
func (engine *Engine) Sync(beans ...interface{}) error {
	for _, bean := range beans {
		table := engine.TableInfo(bean)

		s := engine.NewSession()
		defer s.Close()
		isExist, err := s.Table(bean).isTableExist(table.Name)
		if err != nil {
			return err
		}
		if !isExist {
			err = engine.CreateTables(bean)
			if err != nil {
				return err
			}
		}
		/*isEmpty, err := engine.IsEmptyTable(bean)
		  if err != nil {
		      return err
		  }*/
		var isEmpty bool = false
		if isEmpty {
			err = engine.DropTables(bean)
			if err != nil {
				return err
			}
			err = engine.CreateTables(bean)
			if err != nil {
				return err
			}
		} else {
			for _, col := range table.Columns() {
				session := engine.NewSession()
				session.Statement.RefTable = table
				defer session.Close()
				isExist, err := session.Engine.dialect.IsColumnExist(table.Name, col)
				if err != nil {
					return err
				}
				if !isExist {
					session := engine.NewSession()
					session.Statement.RefTable = table
					defer session.Close()
					err = session.addColumn(col.Name)
					if err != nil {
						return err
					}
				}
			}

			for name, index := range table.Indexes {
				session := engine.NewSession()
				session.Statement.RefTable = table
				defer session.Close()
				if index.Type == core.UniqueType {
					//isExist, err := session.isIndexExist(table.Name, name, true)
					isExist, err := session.isIndexExist2(table.Name, index.Cols, true)
					if err != nil {
						return err
					}
					if !isExist {
						session := engine.NewSession()
						session.Statement.RefTable = table
						defer session.Close()
						err = session.addUnique(table.Name, name)
						if err != nil {
							return err
						}
					}
				} else if index.Type == core.IndexType {
					isExist, err := session.isIndexExist2(table.Name, index.Cols, false)
					if err != nil {
						return err
					}
					if !isExist {
						session := engine.NewSession()
						session.Statement.RefTable = table
						defer session.Close()
						err = session.addIndex(table.Name, name)
						if err != nil {
							return err
						}
					}
				} else {
					return errors.New("unknow index type")
				}
			}
		}
	}
	return nil
}

func (engine *Engine) Sync2(beans ...interface{}) error {
	s := engine.NewSession()
	defer s.Close()
	return s.Sync2(beans...)
}

func (engine *Engine) unMap(beans ...interface{}) (e error) {
	engine.mutex.Lock()
	defer engine.mutex.Unlock()
	for _, bean := range beans {
		t := rType(bean)
		if _, ok := engine.Tables[t]; ok {
			delete(engine.Tables, t)
		}
	}
	return
}

// Drop all mapped table
func (engine *Engine) dropAll() error {
	session := engine.NewSession()
	defer session.Close()

	err := session.Begin()
	if err != nil {
		return err
	}
	err = session.dropAll()
	if err != nil {
		session.Rollback()
		return err
	}
	return session.Commit()
}

// CreateTables create tabls according bean
func (engine *Engine) CreateTables(beans ...interface{}) error {
	session := engine.NewSession()
	err := session.Begin()
	defer session.Close()
	if err != nil {
		return err
	}

	for _, bean := range beans {
		err = session.CreateTable(bean)
		if err != nil {
			session.Rollback()
			return err
		}
	}
	return session.Commit()
}

func (engine *Engine) DropTables(beans ...interface{}) error {
	session := engine.NewSession()
	defer session.Close()

	err := session.Begin()
	if err != nil {
		return err
	}

	for _, bean := range beans {
		err = session.DropTable(bean)
		if err != nil {
			session.Rollback()
			return err
		}
	}
	return session.Commit()
}

func (engine *Engine) createAll() error {
	session := engine.NewSession()
	defer session.Close()
	return session.createAll()
}

// Exec raw sql
func (engine *Engine) Exec(sql string, args ...interface{}) (sql.Result, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Exec(sql, args...)
}

// Exec a raw sql and return records as []map[string][]byte
func (engine *Engine) Query(sql string, paramStr ...interface{}) (resultsSlice []map[string][]byte, err error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Query(sql, paramStr...)
}

// Insert one or more records
func (engine *Engine) Insert(beans ...interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Insert(beans...)
}

// Insert only one record
func (engine *Engine) InsertOne(bean interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.InsertOne(bean)
}

// Update records, bean's non-empty fields are updated contents,
// condiBean' non-empty filds are conditions
// CAUTION:
//        1.bool will defaultly be updated content nor conditions
//         You should call UseBool if you have bool to use.
//        2.float32 & float64 may be not inexact as conditions
func (engine *Engine) Update(bean interface{}, condiBeans ...interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Update(bean, condiBeans...)
}

// Delete records, bean's non-empty fields are conditions
func (engine *Engine) Delete(bean interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Delete(bean)
}

// Get retrieve one record from table, bean's non-empty fields
// are conditions
func (engine *Engine) Get(bean interface{}) (bool, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Get(bean)
}

// Find retrieve records from table, condiBeans's non-empty fields
// are conditions. beans could be []Struct, []*Struct, map[int64]Struct
// map[int64]*Struct
func (engine *Engine) Find(beans interface{}, condiBeans ...interface{}) error {
	session := engine.NewSession()
	defer session.Close()
	return session.Find(beans, condiBeans...)
}

// Iterate record by record handle records from table, bean's non-empty fields
// are conditions.
func (engine *Engine) Iterate(bean interface{}, fun IterFunc) error {
	session := engine.NewSession()
	defer session.Close()
	return session.Iterate(bean, fun)
}

// Return sql.Rows compatible Rows obj, as a forward Iterator object for iterating record by record, bean's non-empty fields
// are conditions.
func (engine *Engine) Rows(bean interface{}) (*Rows, error) {
	session := engine.NewSession()
	return session.Rows(bean)
}

// Count counts the records. bean's non-empty fields
// are conditions.
func (engine *Engine) Count(bean interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Count(bean)
}

// Import SQL DDL file
func (engine *Engine) ImportFile(ddlPath string) ([]sql.Result, error) {
	file, err := os.Open(ddlPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return engine.Import(file)
}

// Import SQL DDL file
func (engine *Engine) Import(r io.Reader) ([]sql.Result, error) {
	var results []sql.Result
	var lastError error
	scanner := bufio.NewScanner(r)

	semiColSpliter := func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		if i := bytes.IndexByte(data, ';'); i >= 0 {
			return i + 1, data[0:i], nil
		}
		// If we're at EOF, we have a final, non-terminated line. Return it.
		if atEOF {
			return len(data), data, nil
		}
		// Request more data.
		return 0, nil, nil
	}

	scanner.Split(semiColSpliter)

	for scanner.Scan() {
		query := scanner.Text()
		query = strings.Trim(query, " \t")
		if len(query) > 0 {
			result, err := engine.DB().Exec(query)
			results = append(results, result)
			if err != nil {
				lastError = err
			}
		}
	}
	return results, lastError
}

var (
	NULL_TIME time.Time
)

func (engine *Engine) TZTime(t time.Time) time.Time {

	if NULL_TIME != t { // if time is not initialized it's not suitable for Time.In()
		return t.In(engine.TZLocation)
	}
	return t
}

func (engine *Engine) NowTime(sqlTypeName string) interface{} {
	t := time.Now()
	return engine.FormatTime(sqlTypeName, t)
}

func (engine *Engine) NowTime2(sqlTypeName string) (interface{}, time.Time) {
	t := time.Now()
	return engine.FormatTime(sqlTypeName, t), t
}

func (engine *Engine) FormatTime(sqlTypeName string, t time.Time) (v interface{}) {
	if engine.dialect.DBType() == core.ORACLE {
		return t
	}
	switch sqlTypeName {
	case core.Time:
		s := engine.TZTime(t).Format("2006-01-02 15:04:05") //time.RFC3339
		v = s[11:19]
	case core.Date:
		v = engine.TZTime(t).Format("2006-01-02")
	case core.DateTime, core.TimeStamp:
		if engine.dialect.DBType() == "ql" {
			v = engine.TZTime(t)
		} else if engine.dialect.DBType() == "sqlite3" {
			v = engine.TZTime(t).UTC().Format("2006-01-02 15:04:05")
		} else {
			v = engine.TZTime(t).Format("2006-01-02 15:04:05")
		}
	case core.TimeStampz:
		if engine.dialect.DBType() == core.MSSQL {
			v = engine.TZTime(t).Format("2006-01-02T15:04:05.9999999Z07:00")
		} else if engine.DriverName() == "mssql" {
			v = engine.TZTime(t)
		} else {
			v = engine.TZTime(t).Format(time.RFC3339Nano)
		}
	case core.BigInt, core.Int:
		v = engine.TZTime(t).Unix()
	default:
		v = engine.TZTime(t)
	}
	return
}

// Always disable struct tag "deleted"
func (engine *Engine) Unscoped() *Session {
	session := engine.NewSession()
	session.IsAutoClose = true
	return session.Unscoped()
}
