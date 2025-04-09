// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build go1.8
// +build go1.8

package xorm

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"reflect"
	"runtime"
	"sync"
	"time"
)

const (
	// Version show the xorm's version
	Version string = "0.8.0.1015"

	Spanner = "spanner"
)

func regDrvsNDialects() bool {
	providedDrvsNDialects := map[string]struct {
		dbType     coreDbType
		getDriver  func() Driver
		getDialect func() coreDialect
	}{
		"mysql":    {"mysql", func() Driver { return &mysqlDriver{} }, func() coreDialect { return &mysql{} }},
		"mymysql":  {"mysql", func() Driver { return &mymysqlDriver{} }, func() coreDialect { return &mysql{} }},
		"postgres": {"postgres", func() Driver { return &pqDriver{} }, func() coreDialect { return &postgres{} }},
		"pgx":      {"postgres", func() Driver { return &pqDriverPgx{} }, func() coreDialect { return &postgres{} }},
		"sqlite3":  {"sqlite3", func() Driver { return &sqlite3Driver{} }, func() coreDialect { return &sqlite3{} }},
	}

	for driverName, v := range providedDrvsNDialects {
		if driver := QueryDriver(driverName); driver == nil {
			RegisterDriver(driverName, v.getDriver())
			RegisterDialect(v.dbType, v.getDialect)
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
	driver := QueryDriver(driverName)
	if driver == nil {
		return nil, fmt.Errorf("unsupported driver name: %v", driverName)
	}

	uri, err := driver.Parse(driverName, dataSourceName)
	if err != nil {
		return nil, err
	}

	dialect := QueryDialect(uri.DbType)
	if dialect == nil {
		return nil, fmt.Errorf("unsupported dialect type: %v", uri.DbType)
	}

	db, err := Open(driverName, dataSourceName)
	if err != nil {
		return nil, err
	}

	err = dialect.Init(db, uri, driverName, dataSourceName)
	if err != nil {
		return nil, err
	}

	engine := &Engine{
		db:              db,
		dialect:         dialect,
		Tables:          make(map[reflect.Type]*coreTable),
		mutex:           &sync.RWMutex{},
		TagIdentifier:   "xorm",
		TZLocation:      time.Local,
		tagHandlers:     defaultTagHandlers,
		defaultContext:  context.Background(),
		timestampFormat: "2006-01-02 15:04:05",
	}

	switch uri.DbType {
	case SQLITE:
		engine.DatabaseTZ = time.UTC
	case Spanner:
		engine.DatabaseTZ = time.UTC
		// We need to specify "Z" to indicate that timestamp is in UTC.
		// Otherwise Spanner uses default America/Los_Angeles timezone.
		// https://cloud.google.com/spanner/docs/reference/standard-sql/data-types#time_zones
		engine.timestampFormat = "2006-01-02 15:04:05Z"
	default:
		engine.DatabaseTZ = time.Local
	}

	logger := NewSimpleLogger(os.Stdout)
	logger.SetLevel(LOG_INFO)
	engine.SetLogger(logger)
	engine.SetMapper(NewCacheMapper(new(coreSnakeMapper)))

	runtime.SetFinalizer(engine, close)

	if ext, ok := dialect.(DialectWithSequenceGenerator); ok {
		engine.sequenceGenerator, err = ext.CreateSequenceGenerator(db.DB)
		if err != nil {
			return nil, fmt.Errorf("failed to create sequence generator: %w", err)
		}
	}

	return engine, nil
}

func (engine *Engine) ResetSequenceGenerator() {
	if engine.sequenceGenerator != nil {
		engine.sequenceGenerator.Reset()
	}
}

type SequenceGenerator interface {
	Next(ctx context.Context, table, column string) (int64, error)
	Reset()
}

type DialectWithSequenceGenerator interface {
	coreDialect

	// CreateSequenceGenerator returns optional generator used to create AUTOINCREMENT ids for inserts.
	CreateSequenceGenerator(db *sql.DB) (SequenceGenerator, error)
}

type DialectWithRetryableErrors interface {
	coreDialect
	RetryOnError(err error) bool
}
