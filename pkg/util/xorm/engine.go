// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"context"
	"database/sql"
	"encoding/gob"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm/core"
	"xorm.io/builder"
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

	mutex *sync.RWMutex

	showSQL      bool
	showExecTime bool

	logger          core.ILogger
	TZLocation      *time.Location // The timezone of the application
	DatabaseTZ      *time.Location // The timezone of the database
	timestampFormat string         // Format applied to time.Time before passing it to database in Timestamp and DateTime columns.

	tagHandlers map[string]tagHandler

	defaultContext    context.Context
	sequenceGenerator SequenceGenerator // If not nil, this generator is used to generate auto-increment values for inserts.
}

// CondDeleted returns the conditions whether a record is soft deleted.
func (engine *Engine) CondDeleted(col *core.Column) builder.Cond {
	var cond = builder.NewCond()
	if col.SQLType.IsNumeric() {
		cond = builder.Eq{col.Name: 0}
	}

	if col.Nullable {
		cond = cond.Or(builder.IsNull{col.Name})
	}

	return cond
}

// ShowSQL show SQL statement or not on logger if log level is great than INFO
func (engine *Engine) ShowSQL(show ...bool) {
	engine.logger.ShowSQL(show...)
	if len(show) == 0 {
		engine.showSQL = true
	} else {
		engine.showSQL = show[0]
	}
}

// ShowExecTime show SQL statement and execute time or not on logger if log level is great than INFO
func (engine *Engine) ShowExecTime(show ...bool) {
	if len(show) == 0 {
		engine.showExecTime = true
	} else {
		engine.showExecTime = show[0]
	}
}

// SetLogger set the new logger
func (engine *Engine) SetLogger(logger core.ILogger) {
	engine.logger = logger
	engine.showSQL = logger.IsShowSQL()
	engine.dialect.SetLogger(logger)
}

// DriverName return the current sql driver's name
func (engine *Engine) DriverName() string {
	return engine.dialect.DriverName()
}

// DataSourceName return the current connection string
func (engine *Engine) DataSourceName() string {
	return engine.dialect.DataSourceName()
}

// SetMapper set the name mapping rules
func (engine *Engine) SetMapper(mapper core.IMapper) {
	engine.SetTableMapper(mapper)
	engine.SetColumnMapper(mapper)
}

// SetTableMapper set the table name mapping rule
func (engine *Engine) SetTableMapper(mapper core.IMapper) {
	engine.TableMapper = mapper
}

// SetColumnMapper set the column name mapping rule
func (engine *Engine) SetColumnMapper(mapper core.IMapper) {
	engine.ColumnMapper = mapper
}

// SupportInsertMany If engine's database support batch insert records like
// "insert into user values (name, age), (name, age)".
// When the return is ture, then engine.Insert(&users) will
// generate batch sql and exeute.
func (engine *Engine) SupportInsertMany() bool {
	return engine.dialect.SupportInsertMany()
}

func (engine *Engine) quoteColumns(columnStr string) string {
	columns := strings.Split(columnStr, ",")
	for i := 0; i < len(columns); i++ {
		columns[i] = engine.Quote(strings.TrimSpace(columns[i]))
	}
	return strings.Join(columns, ",")
}

// Quote Use QuoteStr quote the string sql
func (engine *Engine) Quote(value string) string {
	value = strings.TrimSpace(value)
	if len(value) == 0 {
		return value
	}

	buf := strings.Builder{}
	engine.QuoteTo(&buf, value)

	return buf.String()
}

// QuoteTo quotes string and writes into the buffer
func (engine *Engine) QuoteTo(buf *strings.Builder, value string) {
	if buf == nil {
		return
	}

	value = strings.TrimSpace(value)
	if value == "" {
		return
	}

	quoteTo(buf, engine.dialect.Quote(""), value)
}

func quoteTo(buf *strings.Builder, quotePair string, value string) {
	if len(quotePair) < 2 { // no quote
		_, _ = buf.WriteString(value)
		return
	}

	prefix, suffix := quotePair[0], quotePair[1]

	i := 0
	for i < len(value) {
		// start of a token; might be already quoted
		if value[i] == '.' {
			_ = buf.WriteByte('.')
			i++
		} else if value[i] == prefix || value[i] == '`' {
			// Has quotes; skip/normalize `name` to prefix+name+sufix
			var ch byte
			if value[i] == prefix {
				ch = suffix
			} else {
				ch = '`'
			}
			i++
			_ = buf.WriteByte(prefix)
			for ; i < len(value) && value[i] != ch; i++ {
				_ = buf.WriteByte(value[i])
			}
			_ = buf.WriteByte(suffix)
			i++
		} else {
			// Requires quotes
			_ = buf.WriteByte(prefix)
			for ; i < len(value) && value[i] != '.'; i++ {
				_ = buf.WriteByte(value[i])
			}
			_ = buf.WriteByte(suffix)
		}
	}
}

func (engine *Engine) quote(sql string) string {
	return engine.dialect.Quote(sql)
}

// SetConnMaxLifetime sets the maximum amount of time a connection may be reused.
func (engine *Engine) SetConnMaxLifetime(d time.Duration) {
	engine.db.SetConnMaxLifetime(d)
}

// SetMaxOpenConns is only available for go 1.2+
func (engine *Engine) SetMaxOpenConns(conns int) {
	engine.db.SetMaxOpenConns(conns)
}

// SetMaxIdleConns set the max idle connections on pool, default is 2
func (engine *Engine) SetMaxIdleConns(conns int) {
	engine.db.SetMaxIdleConns(conns)
}

// NewDB provides an interface to operate database directly
func (engine *Engine) NewDB() (*core.DB, error) {
	return core.OpenDialect(engine.dialect)
}

// DB return the wrapper of sql.DB
func (engine *Engine) DB() *core.DB {
	return engine.db
}

// Dialect return database dialect
func (engine *Engine) Dialect() core.Dialect {
	return engine.dialect
}

// NewSession New a session
func (engine *Engine) NewSession() *Session {
	session := &Session{engine: engine}
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
	return session.Ping()
}

// SQL method let's you manually write raw SQL and operate
// For example:
//
//	engine.SQL("select * from user").Find(&users)
//
// This    code will execute "select * from user" and set the records to users
func (engine *Engine) SQL(query any, args ...any) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.SQL(query, args...)
}

// NoAutoTime Default if your struct has "created" or "updated" filed tag, the fields
// will automatically be filled with current time when Insert or Update
// invoked. Call NoAutoTime if you dont' want to fill automatically.
func (engine *Engine) NoAutoTime() *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.NoAutoTime()
}

func (engine *Engine) loadTableInfo(table *core.Table) error {
	colSeq, cols, err := engine.dialect.GetColumns(table.Name)
	if err != nil {
		return err
	}
	for _, name := range colSeq {
		table.AddColumn(cols[name])
	}
	indexes, err := engine.dialect.GetIndexes(table.Name)
	if err != nil {
		return err
	}
	table.Indexes = indexes

	for _, index := range indexes {
		for _, name := range index.Cols {
			if col := table.GetColumn(name); col != nil {
				col.Indexes[index.Name] = index.Type
			}
		}
	}
	return nil
}

// DBMetas Retrieve all tables, columns, indexes' informations from database.
func (engine *Engine) DBMetas() ([]*core.Table, error) {
	tables, err := engine.dialect.GetTables()
	if err != nil {
		return nil, err
	}

	for _, table := range tables {
		if err = engine.loadTableInfo(table); err != nil {
			return nil, err
		}
	}
	return tables, nil
}

// Where method provide a condition query
func (engine *Engine) Where(query any, args ...any) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Where(query, args...)
}

// ID method provoide a condition as (id) = ?
func (engine *Engine) ID(id any) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.ID(id)
}

// Before apply before Processor, affected bean is passed to closure arg
func (engine *Engine) Before(closures func(any)) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Before(closures)
}

// After apply after insert Processor, affected bean is passed to closure arg
func (engine *Engine) After(closures func(any)) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.After(closures)
}

// Charset set charset when create table, only support mysql now
func (engine *Engine) Charset(charset string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Charset(charset)
}

// StoreEngine set store engine when create table, only support mysql now
func (engine *Engine) StoreEngine(storeEngine string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.StoreEngine(storeEngine)
}

// Table temporarily change the Get, Find, Update's table
func (engine *Engine) Table(tableNameOrBean any) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Table(tableNameOrBean)
}

func (engine *Engine) autoMapType(v reflect.Value) (*core.Table, error) {
	t := v.Type()
	engine.mutex.Lock()
	defer engine.mutex.Unlock()
	table, ok := engine.Tables[t]
	if !ok {
		var err error
		table, err = engine.mapType(v)
		if err != nil {
			return nil, err
		}

		engine.Tables[t] = table
	}
	return table, nil
}

// GobRegister register one struct to gob for cache use
func (engine *Engine) GobRegister(v any) *Engine {
	gob.Register(v)
	return engine
}

// Table table struct
type Table struct {
	*core.Table
	Name string
}

func addIndex(indexName string, table *core.Table, col *core.Column, indexType int) {
	if index, ok := table.Indexes[indexName]; ok {
		index.AddColumn(col.Name)
		col.Indexes[index.Name] = indexType
	} else {
		index := core.NewIndex(indexName, indexType)
		index.AddColumn(col.Name)
		table.AddIndex(index)
		col.Indexes[index.Name] = indexType
	}
}

// TableName table name interface to define customerize table name
type TableName interface {
	TableName() string
}

var (
	tpTableName = reflect.TypeOf((*TableName)(nil)).Elem()
)

func (engine *Engine) mapType(v reflect.Value) (*core.Table, error) {
	t := v.Type()
	table := core.NewEmptyTable()
	table.Type = t
	table.Name = getTableName(engine.TableMapper, v)

	var idFieldColName string

	for i := 0; i < t.NumField(); i++ {
		tag := t.Field(i).Tag

		ormTagStr := tag.Get(engine.TagIdentifier)
		var col *core.Column
		fieldValue := v.Field(i)
		fieldType := fieldValue.Type()

		if ormTagStr != "" {
			col = &core.Column{
				FieldName:       t.Field(i).Name,
				Nullable:        true,
				IsPrimaryKey:    false,
				IsAutoIncrement: false,
				Indexes:         make(map[string]int),
				DefaultIsEmpty:  true,
			}
			tags := splitTag(ormTagStr)

			if len(tags) > 0 {
				if tags[0] == "-" {
					continue
				}

				var ctx = tagContext{
					table:      table,
					col:        col,
					fieldValue: fieldValue,
					indexNames: make(map[string]int),
					engine:     engine,
				}

				if strings.HasPrefix(strings.ToUpper(tags[0]), "EXTENDS") {
					pStart := strings.Index(tags[0], "(")
					if pStart > -1 && strings.HasSuffix(tags[0], ")") {
						var tagPrefix = strings.TrimFunc(tags[0][pStart+1:len(tags[0])-1], func(r rune) bool {
							return r == '\'' || r == '"'
						})

						ctx.params = []string{tagPrefix}
					}

					if err := ExtendsTagHandler(&ctx); err != nil {
						return nil, err
					}
					continue
				}

				for j, key := range tags {
					if ctx.ignoreNext {
						ctx.ignoreNext = false
						continue
					}

					k := strings.ToUpper(key)
					ctx.tagName = k
					ctx.params = []string{}

					pStart := strings.Index(k, "(")
					if pStart == 0 {
						return nil, errors.New("( could not be the first character")
					}
					if pStart > -1 {
						if !strings.HasSuffix(k, ")") {
							return nil, fmt.Errorf("field %s tag %s cannot match ) character", col.FieldName, key)
						}

						ctx.tagName = k[:pStart]
						ctx.params = strings.Split(key[pStart+1:len(k)-1], ",")
					}

					if j > 0 {
						ctx.preTag = strings.ToUpper(tags[j-1])
					}
					if j < len(tags)-1 {
						ctx.nextTag = tags[j+1]
					} else {
						ctx.nextTag = ""
					}

					if h, ok := engine.tagHandlers[ctx.tagName]; ok {
						if err := h(&ctx); err != nil {
							return nil, err
						}
					} else {
						if strings.HasPrefix(key, "'") && strings.HasSuffix(key, "'") {
							col.Name = key[1 : len(key)-1]
						} else {
							col.Name = key
						}
					}
				}

				if col.SQLType.Name == "" {
					col.SQLType = core.Type2SQLType(fieldType)
				}
				engine.dialect.SqlType(col)
				if col.Length == 0 {
					col.Length = col.SQLType.DefaultLength
				}
				if col.Length2 == 0 {
					col.Length2 = col.SQLType.DefaultLength2
				}
				if col.Name == "" {
					col.Name = engine.ColumnMapper.Obj2Table(t.Field(i).Name)
				}

				if ctx.isUnique {
					ctx.indexNames[col.Name] = core.UniqueType
				} else if ctx.isIndex {
					ctx.indexNames[col.Name] = core.IndexType
				}

				for indexName, indexType := range ctx.indexNames {
					addIndex(indexName, table, col, indexType)
				}
			}
		} else {
			var sqlType core.SQLType
			if fieldValue.CanAddr() {
				if _, ok := fieldValue.Addr().Interface().(core.Conversion); ok {
					sqlType = core.SQLType{Name: core.Text}
				}
			}
			if _, ok := fieldValue.Interface().(core.Conversion); ok {
				sqlType = core.SQLType{Name: core.Text}
			} else {
				sqlType = core.Type2SQLType(fieldType)
			}
			col = core.NewColumn(engine.ColumnMapper.Obj2Table(t.Field(i).Name),
				t.Field(i).Name, sqlType, sqlType.DefaultLength,
				sqlType.DefaultLength2, true)

			if fieldType.Kind() == reflect.Int64 && (strings.ToUpper(col.FieldName) == "ID" || strings.HasSuffix(strings.ToUpper(col.FieldName), ".ID")) {
				idFieldColName = col.Name
			}
		}
		if col.IsAutoIncrement {
			col.Nullable = false
		}

		table.AddColumn(col)

	} // end for

	if idFieldColName != "" && len(table.PrimaryKeys) == 0 {
		col := table.GetColumn(idFieldColName)
		col.IsPrimaryKey = true
		col.IsAutoIncrement = true
		col.Nullable = false
		table.PrimaryKeys = append(table.PrimaryKeys, col.Name)
		table.AutoIncrement = col.Name
	}

	return table, nil
}

// IsTableExist if a table is exist
func (engine *Engine) IsTableExist(beanOrTableName any) (bool, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.IsTableExist(beanOrTableName)
}

// Sync the new struct changes to database, this method will automatically add
// table, column, index, unique. but will not delete or change anything.
// If you change some field, you should change the database manually.
func (engine *Engine) Sync(beans ...any) error {
	session := engine.NewSession()
	defer session.Close()

	for _, bean := range beans {
		v := rValue(bean)
		tableNameNoSchema := engine.TableName(bean)
		table, err := engine.autoMapType(v)
		if err != nil {
			return err
		}

		isExist, err := session.Table(bean).isTableExist(tableNameNoSchema)
		if err != nil {
			return err
		}
		if !isExist {
			err = session.createTable(bean)
			if err != nil {
				return err
			}
		}

		var isEmpty bool
		if isEmpty {
			err = session.dropTable(bean)
			if err != nil {
				return err
			}
			err = session.createTable(bean)
			if err != nil {
				return err
			}
		} else {
			for _, col := range table.Columns() {
				isExist, err := engine.dialect.IsColumnExist(tableNameNoSchema, col.Name)
				if err != nil {
					return err
				}
				if !isExist {
					if err := session.statement.setRefBean(bean); err != nil {
						return err
					}
					err = session.addColumn(col.Name)
					if err != nil {
						return err
					}
				}
			}

			for name, index := range table.Indexes {
				if err := session.statement.setRefBean(bean); err != nil {
					return err
				}
				if index.Type == core.UniqueType {
					isExist, err := session.isIndexExist2(tableNameNoSchema, index.Cols, true)
					if err != nil {
						return err
					}
					if !isExist {
						if err := session.statement.setRefBean(bean); err != nil {
							return err
						}

						err = session.addUnique(tableNameNoSchema, name)
						if err != nil {
							return err
						}
					}
				} else if index.Type == core.IndexType {
					isExist, err := session.isIndexExist2(tableNameNoSchema, index.Cols, false)
					if err != nil {
						return err
					}
					if !isExist {
						if err := session.statement.setRefBean(bean); err != nil {
							return err
						}

						err = session.addIndex(tableNameNoSchema, name)
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

// Sync2 synchronize structs to database tables
func (engine *Engine) Sync2(beans ...any) error {
	s := engine.NewSession()
	defer s.Close()
	return s.Sync2(beans...)
}

// Exec raw sql
func (engine *Engine) Exec(sqlOrArgs ...any) (sql.Result, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Exec(sqlOrArgs...)
}

// Insert one or more records
func (engine *Engine) Insert(beans ...any) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Insert(beans...)
}

// Find retrieve records from table, condiBeans's non-empty fields
// are conditions. beans could be []Struct, []*Struct, map[int64]Struct
// map[int64]*Struct
func (engine *Engine) Find(beans any, condiBeans ...any) error {
	session := engine.NewSession()
	defer session.Close()
	return session.Find(beans, condiBeans...)
}

// nowTime return current time
func (engine *Engine) nowTime(col *core.Column) (any, time.Time) {
	t := time.Now()
	var tz = engine.DatabaseTZ
	if !col.DisableTimeZone && col.TimeZone != nil {
		tz = col.TimeZone
	}
	return engine.formatTime(col.SQLType.Name, t.In(tz)), t.In(engine.TZLocation)
}

func (engine *Engine) formatColTime(col *core.Column, t time.Time) (v any) {
	if t.IsZero() {
		if col.Nullable {
			return nil
		}
		return ""
	}

	if col.TimeZone != nil {
		return engine.formatTime(col.SQLType.Name, t.In(col.TimeZone))
	}
	return engine.formatTime(col.SQLType.Name, t.In(engine.DatabaseTZ))
}

// formatTime format time as column type
func (engine *Engine) formatTime(sqlTypeName string, t time.Time) (v any) {
	switch sqlTypeName {
	case core.Time:
		s := t.Format("2006-01-02 15:04:05") // time.RFC3339
		v = s[11:19]
	case core.Date:
		v = t.Format("2006-01-02")
	case core.DateTime, core.TimeStamp:
		v = t.Format(engine.timestampFormat)
	case core.Varchar: // !DarthPestilane! format time when sqlTypeName is core.Varchar.
		v = t.Format("2006-01-02 15:04:05")
	case core.TimeStampz:
		v = t.Format(time.RFC3339Nano)
	case core.BigInt, core.Int:
		v = t.Unix()
	default:
		v = t
	}
	return
}
