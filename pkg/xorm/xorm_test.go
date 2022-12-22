// Copyright 2018 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"testing"

	_ "github.com/denisenkom/go-mssqldb"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	_ "github.com/ziutek/mymysql/godrv"
	"xorm.io/core"
)

var (
	testEngine EngineInterface
	dbType     string
	connString string

	db                 = flag.String("db", "sqlite3", "the tested database")
	showSQL            = flag.Bool("show_sql", true, "show generated SQLs")
	ptrConnStr         = flag.String("conn_str", "./test.db?cache=shared&mode=rwc", "test database connection string")
	mapType            = flag.String("map_type", "snake", "indicate the name mapping")
	cache              = flag.Bool("cache", false, "if enable cache")
	cluster            = flag.Bool("cluster", false, "if this is a cluster")
	splitter           = flag.String("splitter", ";", "the splitter on connstr for cluster")
	schema             = flag.String("schema", "", "specify the schema")
	ignoreSelectUpdate = flag.Bool("ignore_select_update", false, "ignore select update if implementation difference, only for tidb")

	tableMapper core.IMapper
	colMapper   core.IMapper
)

func createEngine(dbType, connStr string) error {
	if testEngine == nil {
		var err error

		if !*cluster {
			switch strings.ToLower(dbType) {
			case core.MSSQL:
				db, err := sql.Open(dbType, strings.Replace(connStr, "xorm_test", "master", -1))
				if err != nil {
					return err
				}
				if _, err = db.Exec("If(db_id(N'xorm_test') IS NULL) BEGIN CREATE DATABASE xorm_test; END;"); err != nil {
					return fmt.Errorf("db.Exec: %v", err)
				}
				db.Close()
				*ignoreSelectUpdate = true
			case core.POSTGRES:
				db, err := sql.Open(dbType, connStr)
				if err != nil {
					return err
				}
				rows, err := db.Query(fmt.Sprintf("SELECT 1 FROM pg_database WHERE datname = 'xorm_test'"))
				if err != nil {
					return fmt.Errorf("db.Query: %v", err)
				}
				defer rows.Close()

				if !rows.Next() {
					if _, err = db.Exec("CREATE DATABASE xorm_test"); err != nil {
						return fmt.Errorf("CREATE DATABASE: %v", err)
					}
				}
				if *schema != "" {
					if _, err = db.Exec("CREATE SCHEMA IF NOT EXISTS " + *schema); err != nil {
						return fmt.Errorf("CREATE SCHEMA: %v", err)
					}
				}
				db.Close()
				*ignoreSelectUpdate = true
			case core.MYSQL:
				db, err := sql.Open(dbType, strings.Replace(connStr, "xorm_test", "mysql", -1))
				if err != nil {
					return err
				}
				if _, err = db.Exec("CREATE DATABASE IF NOT EXISTS xorm_test"); err != nil {
					return fmt.Errorf("db.Exec: %v", err)
				}
				db.Close()
			default:
				*ignoreSelectUpdate = true
			}

			testEngine, err = NewEngine(dbType, connStr)
		} else {
			testEngine, err = NewEngineGroup(dbType, strings.Split(connStr, *splitter))
			if dbType != "mysql" && dbType != "mymysql" {
				*ignoreSelectUpdate = true
			}
		}
		if err != nil {
			return err
		}

		if *schema != "" {
			testEngine.SetSchema(*schema)
		}
		testEngine.ShowSQL(*showSQL)
		testEngine.SetLogLevel(core.LOG_DEBUG)
		if *cache {
			cacher := NewLRUCacher(NewMemoryStore(), 100000)
			testEngine.SetDefaultCacher(cacher)
		}

		if len(*mapType) > 0 {
			switch *mapType {
			case "snake":
				testEngine.SetMapper(core.SnakeMapper{})
			case "same":
				testEngine.SetMapper(core.SameMapper{})
			case "gonic":
				testEngine.SetMapper(core.LintGonicMapper)
			}
		}
	}

	tableMapper = testEngine.GetTableMapper()
	colMapper = testEngine.GetColumnMapper()

	tables, err := testEngine.DBMetas()
	if err != nil {
		return err
	}
	var tableNames = make([]interface{}, 0, len(tables))
	for _, table := range tables {
		tableNames = append(tableNames, table.Name)
	}
	if err = testEngine.DropTables(tableNames...); err != nil {
		return err
	}
	return nil
}

func prepareEngine() error {
	return createEngine(dbType, connString)
}

func TestMain(m *testing.M) {
	flag.Parse()

	dbType = *db
	if *db == "sqlite3" {
		if ptrConnStr == nil {
			connString = "./test.db?cache=shared&mode=rwc"
		} else {
			connString = *ptrConnStr
		}
	} else {
		if ptrConnStr == nil {
			log.Fatal("you should indicate conn string")
			return
		}
		connString = *ptrConnStr
	}

	dbs := strings.Split(*db, "::")
	conns := strings.Split(connString, "::")

	var res int
	for i := 0; i < len(dbs); i++ {
		dbType = dbs[i]
		connString = conns[i]
		testEngine = nil
		fmt.Println("testing", dbType, connString)

		if err := prepareEngine(); err != nil {
			log.Fatal(err)
			return
		}

		code := m.Run()
		if code > 0 {
			res = code
		}
	}

	os.Exit(res)
}

func TestPing(t *testing.T) {
	if err := testEngine.Ping(); err != nil {
		t.Fatal(err)
	}
}
