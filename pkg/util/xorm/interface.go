// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"context"
	"database/sql"
	"reflect"
	"time"

	"xorm.io/core"
)

// Interface defines the interface which Engine and Session will implementate.
type Interface interface {
	AllCols() SessionInterface
	Alias(alias string) SessionInterface
	Asc(colNames ...string) SessionInterface
	BufferSize(size int) SessionInterface
	Cols(columns ...string) SessionInterface
	Count(...interface{}) (int64, error)
	CreateIndexes(bean interface{}) error
	CreateUniques(bean interface{}) error
	Decr(column string, arg ...interface{}) SessionInterface
	Desc(...string) SessionInterface
	Delete(interface{}) (int64, error)
	Distinct(columns ...string) SessionInterface
	DropIndexes(bean interface{}) error
	Exec(sqlOrArgs ...interface{}) (sql.Result, error)
	Exist(bean ...interface{}) (bool, error)
	Find(interface{}, ...interface{}) error
	FindAndCount(interface{}, ...interface{}) (int64, error)
	Get(interface{}) (bool, error)
	GroupBy(keys string) SessionInterface
	ID(interface{}) SessionInterface
	In(string, ...interface{}) SessionInterface
	Incr(column string, arg ...interface{}) SessionInterface
	Insert(...interface{}) (int64, error)
	InsertOne(interface{}) (int64, error)
	IsTableEmpty(bean interface{}) (bool, error)
	IsTableExist(beanOrTableName interface{}) (bool, error)
	Iterate(interface{}, IterFunc) error
	Limit(int, ...int) SessionInterface
	MustCols(columns ...string) SessionInterface
	NoAutoCondition(...bool) SessionInterface
	NotIn(string, ...interface{}) SessionInterface
	Join(joinOperator string, tablename interface{}, condition string, args ...interface{}) SessionInterface
	Omit(columns ...string) SessionInterface
	OrderBy(order string) SessionInterface
	Ping() error
	Query(sqlOrArgs ...interface{}) (resultsSlice []map[string][]byte, err error)
	QueryInterface(sqlOrArgs ...interface{}) ([]map[string]interface{}, error)
	QueryString(sqlOrArgs ...interface{}) ([]map[string]string, error)
	Rows(bean interface{}) (*Rows, error)
	SetExpr(string, interface{}) SessionInterface
	SQL(interface{}, ...interface{}) SessionInterface
	Sum(bean interface{}, colName string) (float64, error)
	SumInt(bean interface{}, colName string) (int64, error)
	Sums(bean interface{}, colNames ...string) ([]float64, error)
	SumsInt(bean interface{}, colNames ...string) ([]int64, error)
	Table(tableNameOrBean interface{}) SessionInterface
	Unscoped() SessionInterface
	Update(bean interface{}, condiBeans ...interface{}) (int64, error)
	UseBool(...string) SessionInterface
	Where(interface{}, ...interface{}) SessionInterface
}

// EngineInterface defines the interface which Engine will implementate.
type EngineInterface interface {
	Interface

	Before(func(interface{})) SessionInterface
	Charset(charset string) SessionInterface
	CreateTables(...interface{}) error
	DBMetas() ([]*core.Table, error)
	Dialect() core.Dialect
	DropTables(...interface{}) error
	GetColumnMapper() core.IMapper
	GetTableMapper() core.IMapper
	GetTZDatabase() *time.Location
	GetTZLocation() *time.Location
	NewSession() SessionInterface
	NoAutoTime() SessionInterface
	Quote(string) string
	SetConnMaxLifetime(time.Duration)
	SetColumnMapper(core.IMapper)
	SetLogger(logger core.ILogger)
	SetMapper(core.IMapper)
	SetMaxOpenConns(int)
	SetMaxIdleConns(int)
	SetSchema(string)
	SetTableMapper(core.IMapper)
	SetTZDatabase(tz *time.Location)
	SetTZLocation(tz *time.Location)
	ShowExecTime(...bool)
	ShowSQL(show ...bool)
	Sync(...interface{}) error
	Sync2(...interface{}) error
	StoreEngine(storeEngine string) SessionInterface
	TableName(interface{}, ...bool) string
	UnMapType(reflect.Type)
}

type SessionInterface interface {
	Interface
	Close()
	Begin() error
	Rollback() error
	Commit() error
	isTableExist(tableName string) (bool, error)
	NoCascade() SessionInterface
	get(bean interface{}) (bool, error)
	find(rowsSlicePtr interface{}, condiBean ...interface{}) error
	InsertMulti(rowsSlicePtr interface{}) (int64, error)
	Nullable(columns ...string) SessionInterface
	ForUpdate() SessionInterface
	Context(ctx context.Context) SessionInterface
	DB() *core.DB
	Select(str string) SessionInterface
	And(query interface{}, args ...interface{}) SessionInterface
	MustLogSQL(log ...bool) SessionInterface
	IsClosed() bool
}
