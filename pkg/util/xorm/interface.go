// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"reflect"
	"time"

	"xorm.io/core"
)

// Interface defines the interface which Engine and Session will implementate.
type Interface interface {
	AllCols() Interface
	Alias(alias string) Interface
	Asc(colNames ...string) Interface
	BufferSize(size int) Interface
	Cols(columns ...string) Interface
	Count(...interface{}) (int64, error)
	CreateIndexes(bean interface{}) error
	CreateUniques(bean interface{}) error
	Decr(column string, arg ...interface{}) Interface
	Desc(...string) Interface
	Delete(interface{}) (int64, error)
	Distinct(columns ...string) Interface
	DropIndexes(bean interface{}) error
	Exec(sqlOrArgs ...interface{}) (sql.Result, error)
	Exist(bean ...interface{}) (bool, error)
	Find(interface{}, ...interface{}) error
	FindAndCount(interface{}, ...interface{}) (int64, error)
	Get(interface{}) (bool, error)
	GroupBy(keys string) Interface
	ID(interface{}) Interface
	In(string, ...interface{}) Interface
	Incr(column string, arg ...interface{}) Interface
	Insert(...interface{}) (int64, error)
	InsertOne(interface{}) (int64, error)
	IsTableEmpty(bean interface{}) (bool, error)
	IsTableExist(beanOrTableName interface{}) (bool, error)
	Iterate(interface{}, IterFunc) error
	Limit(int, ...int) Interface
	MustCols(columns ...string) Interface
	NoAutoCondition(...bool) Interface
	NotIn(string, ...interface{}) Interface
	Join(joinOperator string, tablename interface{}, condition string, args ...interface{}) *Session
	Omit(columns ...string) Interface
	OrderBy(order string) Interface
	Ping() error
	Query(sqlOrArgs ...interface{}) (resultsSlice []map[string][]byte, err error)
	QueryInterface(sqlOrArgs ...interface{}) ([]map[string]interface{}, error)
	QueryString(sqlOrArgs ...interface{}) ([]map[string]string, error)
	Rows(bean interface{}) (*Rows, error)
	SetExpr(string, interface{}) Interface
	SQL(interface{}, ...interface{}) Interface
	Sum(bean interface{}, colName string) (float64, error)
	SumInt(bean interface{}, colName string) (int64, error)
	Sums(bean interface{}, colNames ...string) ([]float64, error)
	SumsInt(bean interface{}, colNames ...string) ([]int64, error)
	Table(tableNameOrBean interface{}) Interface
	Unscoped() Interface
	Update(bean interface{}, condiBeans ...interface{}) (int64, error)
	UseBool(...string) Interface
	Where(interface{}, ...interface{}) Interface
}

// EngineInterface defines the interface which Engine will implementate.
type EngineInterface interface {
	Interface

	Before(func(interface{})) Interface
	Charset(charset string) Interface
	CreateTables(...interface{}) error
	DBMetas() ([]*core.Table, error)
	Dialect() core.Dialect
	DropTables(...interface{}) error
	GetColumnMapper() core.IMapper
	GetTableMapper() core.IMapper
	GetTZDatabase() *time.Location
	GetTZLocation() *time.Location
	NewSession() Interface
	NoAutoTime() Interface
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
	StoreEngine(storeEngine string) Interface
	TableName(interface{}, ...bool) string
	UnMapType(reflect.Type)
}
