// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.8

package xorm

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"runtime"
	"sync"
	"time"

	"xorm.io/core"
)

const (
	// Version show the xorm's version
	Version string = "0.8.0.1015"
)

func regDrvsNDialects() bool {
	providedDrvsNDialects := map[string]struct {
		dbType     core.DbType
		getDriver  func() core.Driver
		getDialect func() core.Dialect
	}{
		"mssql":    {"mssql", func() core.Driver { return &odbcDriver{} }, func() core.Dialect { return &mssql{} }},
		"odbc":     {"mssql", func() core.Driver { return &odbcDriver{} }, func() core.Dialect { return &mssql{} }}, // !nashtsai! TODO change this when supporting MS Access
		"mysql":    {"mysql", func() core.Driver { return &mysqlDriver{} }, func() core.Dialect { return &mysql{} }},
		"mymysql":  {"mysql", func() core.Driver { return &mymysqlDriver{} }, func() core.Dialect { return &mysql{} }},
		"postgres": {"postgres", func() core.Driver { return &pqDriver{} }, func() core.Dialect { return &postgres{} }},
		"pgx":      {"postgres", func() core.Driver { return &pqDriverPgx{} }, func() core.Dialect { return &postgres{} }},
		"sqlite3":  {"sqlite3", func() core.Driver { return &sqlite3Driver{} }, func() core.Dialect { return &sqlite3{} }},
		"oci8":     {"oracle", func() core.Driver { return &oci8Driver{} }, func() core.Dialect { return &oracle{} }},
		"goracle":  {"oracle", func() core.Driver { return &goracleDriver{} }, func() core.Dialect { return &oracle{} }},
	}

	for driverName, v := range providedDrvsNDialects {
		if driver := core.QueryDriver(driverName); driver == nil {
			core.RegisterDriver(driverName, v.getDriver())
			core.RegisterDialect(v.dbType, v.getDialect)
		}
	}
	return true
}

func close(engine *Engine) {
	engine.Close()
}

func init() {
	regDrvsNDialects()
}

// NewEngine new a db manager according to the parameter. Currently support four
// drivers
func NewEngine(driverName string, dataSourceName string) (*Engine, error) {
	driver := core.QueryDriver(driverName)
	if driver == nil {
		return nil, fmt.Errorf("Unsupported driver name: %v", driverName)
	}

	uri, err := driver.Parse(driverName, dataSourceName)
	if err != nil {
		return nil, err
	}

	dialect := core.QueryDialect(uri.DbType)
	if dialect == nil {
		return nil, fmt.Errorf("Unsupported dialect type: %v", uri.DbType)
	}

	db, err := core.Open(driverName, dataSourceName)
	if err != nil {
		return nil, err
	}

	err = dialect.Init(db, uri, driverName, dataSourceName)
	if err != nil {
		return nil, err
	}

	engine := &Engine{
		db:             db,
		dialect:        dialect,
		Tables:         make(map[reflect.Type]*core.Table),
		mutex:          &sync.RWMutex{},
		TagIdentifier:  "xorm",
		TZLocation:     time.Local,
		tagHandlers:    defaultTagHandlers,
		cachers:        make(map[string]core.Cacher),
		defaultContext: context.Background(),
	}

	if uri.DbType == core.SQLITE {
		engine.DatabaseTZ = time.UTC
	} else {
		engine.DatabaseTZ = time.Local
	}

	logger := NewSimpleLogger(os.Stdout)
	logger.SetLevel(core.LOG_INFO)
	engine.SetLogger(logger)
	engine.SetMapper(core.NewCacheMapper(new(core.SnakeMapper)))

	runtime.SetFinalizer(engine, close)

	return engine, nil
}

// NewEngineWithParams new a db manager with params. The params will be passed to dialect.
func NewEngineWithParams(driverName string, dataSourceName string, params map[string]string) (*Engine, error) {
	engine, err := NewEngine(driverName, dataSourceName)
	engine.dialect.SetParams(params)
	return engine, err
}

// Clone clone an engine
func (engine *Engine) Clone() (*Engine, error) {
	return NewEngine(engine.DriverName(), engine.DataSourceName())
}
