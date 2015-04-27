package sqlutil

import (
	"fmt"

	"github.com/go-xorm/xorm"
)

type TestDB struct {
	DriverName string
	ConnStr    string
}

var TestDB_Sqlite3 = TestDB{DriverName: "sqlite3", ConnStr: ":memory:?_loc=Local"}
var TestDB_Mysql = TestDB{DriverName: "mysql", ConnStr: "grafana:password@tcp(localhost:3306)/grafana_tests?charset=utf8"}
var TestDB_Postgres = TestDB{DriverName: "postgres", ConnStr: "user=grafanatest password=grafanatest host=localhost port=5432 dbname=grafanatest sslmode=disable"}

func CleanDB(x *xorm.Engine) {
	if x.DriverName() == "postgres" {
		sess := x.NewSession()
		defer sess.Close()

		if _, err := sess.Exec("DROP SCHEMA public CASCADE;"); err != nil {
			panic("Failed to drop schema public")
		}

		if _, err := sess.Exec("CREATE SCHEMA public;"); err != nil {
			panic("Failed to create schema public")
		}
	} else if x.DriverName() == "mysql" {
		tables, _ := x.DBMetas()
		sess := x.NewSession()
		defer sess.Close()

		for _, table := range tables {
			if _, err := sess.Exec("set foreign_key_checks = 0"); err != nil {
				panic("failed to disable foreign key checks")
			}
			if _, err := sess.Exec("drop table " + table.Name + " ;"); err != nil {
				panic(fmt.Sprintf("failed to delete table: %v, err: %v", table.Name, err))
			}
			if _, err := sess.Exec("set foreign_key_checks = 1"); err != nil {
				panic("failed to disable foreign key checks")
			}
		}
	}
}
